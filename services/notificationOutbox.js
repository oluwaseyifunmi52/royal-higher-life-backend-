const crypto = require("node:crypto");
const NotificationJob = require("../Models/notificationJob");
const PrayerRequest = require("../Models/prayerRequest");
const Contact = require("../Models/contact");
const {
    sendAdminPrayerNotification,
    sendPrayerConfirmation,
    sendAdminContactNotification,
    sendContactConfirmation,
} = require("../utils/mailer");

const MAX_ATTEMPTS = 8;
const LEASE_MS = 2 * 60 * 1000;
const POLL_MS = 1500;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const JOB_KINDS = ["prayer-admin", "prayer-confirmation", "contact-admin", "contact-confirmation"];

function getJobId(kind, recordId, generation = "") {
    return crypto.createHash("sha256").update(`${kind}:${recordId}:${generation}`).digest("hex");
}

async function enqueueNotification(kind, recordId, model = NotificationJob, generation = "") {
    const _id = getJobId(kind, recordId, generation);
    try {
        await model.updateOne({ _id }, {
            $setOnInsert: {
                _id, kind, recordId, status: "pending", attempts: 0, maxAttempts: MAX_ATTEMPTS,
                nextAttemptAt: new Date(), leaseUntil: null, providerId: "", lastErrorCode: "",
                createdAt: new Date(), updatedAt: new Date(), completedAt: null,
            },
        }, { upsert: true });
    } catch (error) {
        // A concurrent request may win the deterministic _id upsert. Confirm
        // that the intended job exists; do not hide unrelated persistence errors.
        if (error?.code !== 11000 || !await model.exists({ _id })) throw error;
    }
    return _id;
}

async function enqueueSubmissionNotifications(type, recordId, model = NotificationJob) {
    const kinds = type === "prayer"
        ? ["prayer-admin", "prayer-confirmation"]
        : ["contact-admin", "contact-confirmation"];
    for (const kind of kinds) await enqueueNotification(kind, recordId, model);
}

function retryDelay(attempt, random = Math.random) {
    const base = Math.min(30_000 * (2 ** Math.max(0, attempt - 1)), MAX_BACKOFF_MS);
    return Math.round(base * (0.8 + random() * 0.4));
}

async function attachAdminNotificationStatuses(type, records, model = NotificationJob) {
    const list = Array.isArray(records) ? records : [records];
    const adminKind = type === "prayer" ? "prayer-admin" : "contact-admin";
    const ids = list.filter(Boolean).map((record) => getJobId(adminKind, record._id));
    const jobs = ids.length
        ? await model.find({ _id: { $in: ids } }).select("_id status").lean()
        : [];
    const statusById = new Map(jobs.map((job) => [job._id, job.status]));
    return list.map((record) => {
        if (!record) return record;
        const plain = typeof record.toObject === "function" ? record.toObject() : { ...record };
        const status = statusById.get(getJobId(adminKind, record._id));
        plain.notificationQueueStatus = status || (
            ["failed"].includes(record.notificationStatus) ? "failed" :
                ["accepted", "sent"].includes(record.notificationStatus) ? "sent" : "pending"
        );
        return plain;
    });
}

function createNotificationWorker(dependencies = {}) {
    const Job = dependencies.Job || NotificationJob;
    const Prayers = dependencies.PrayerRequest || PrayerRequest;
    const Contacts = dependencies.Contact || Contact;
    const clock = dependencies.clock || (() => new Date());
    const random = dependencies.random || Math.random;
    const send = dependencies.send || {
        "prayer-admin": (record) => sendAdminPrayerNotification({
            id: record.id, reference: record.reference, name: record.name,
            category: record.category, createdAt: record.createdAt,
        }),
        "prayer-confirmation": (record) => sendPrayerConfirmation(
            record.email, record.name, record.reference, record.id, record.createdAt.toISOString()
        ),
        "contact-admin": (record) => sendAdminContactNotification({
            id: record.id, name: record.name, email: record.email, phone: record.phone,
            subject: record.subject, message: record.message, reference: record.reference, createdAt: record.createdAt,
        }),
        "contact-confirmation": (record) => sendContactConfirmation(
            record.email, record.name, record.reference, record.id, record.createdAt.toISOString()
        ),
    };
    const updateSource = dependencies.updateSource || (async (job, result, errorCode, isFinal) => {
        const prayer = job.kind.startsWith("prayer-");
        const Model = prayer ? Prayers : Contacts;
        const isAdmin = job.kind.endsWith("-admin");
        const accepted = !errorCode && (result?.accepted === true || result?.sent === true);
        const patch = { updatedAt: clock() };
        if (isAdmin) {
            patch.notificationStatus = accepted ? "accepted" : isFinal ? "failed" : "pending";
            patch.notificationFailure = accepted ? "" : errorCode || "provider_error";
            patch.notificationProviderId = accepted ? result.id || "" : "";
            if (!prayer) {
                patch.notificationAcceptedAt = accepted ? clock() : null;
                patch.notificationDeliveryStatus = "unknown";
            }
        } else {
            patch.confirmationStatus = accepted ? "accepted" : isFinal ? "failed" : "pending";
        }
        const update = { $set: isAdmin ? { ...patch, lastNotificationAttemptAt: clock() } : patch };
        if (isAdmin) update.$inc = { notificationAttemptCount: 1 };
        await Model.updateOne({ _id: job.recordId }, update);
    });

    async function claim() {
        const now = clock();
        return Job.findOneAndUpdate({
            attempts: { $lt: MAX_ATTEMPTS },
            $or: [
                { status: "pending", nextAttemptAt: { $lte: now } },
                { status: "processing", leaseUntil: { $lte: now } },
            ],
        }, {
            $set: { status: "processing", leaseUntil: new Date(now.getTime() + LEASE_MS), updatedAt: now },
            $inc: { attempts: 1 },
        }, { new: true, sort: { createdAt: 1 } });
    }

    async function markExhaustedLeases() {
        const now = clock();
        const expired = await Job.find({ status: "processing", attempts: { $gte: MAX_ATTEMPTS }, leaseUntil: { $lte: now } }).lean();
        for (const job of expired) {
            const result = await Job.updateOne({ _id: job._id, status: "processing", leaseUntil: { $lte: now } }, {
                $set: { status: "failed", lastErrorCode: "attempt_limit_reached", leaseUntil: null, completedAt: now, updatedAt: now },
            });
            if (result.matchedCount) await updateSource(job, null, "attempt_limit_reached", true);
        }
    }

    async function processOne() {
        await markExhaustedLeases();
        const job = await claim();
        if (!job) return false;
        try {
            const Source = job.kind.startsWith("prayer-") ? Prayers : Contacts;
            const record = await Source.findById(job.recordId);
            if (!record) {
                await Job.updateOne({ _id: job._id, status: "processing" }, {
                    $set: { status: "failed", lastErrorCode: "source_record_missing", leaseUntil: null, completedAt: clock(), updatedAt: clock() },
                });
                return true;
            }
            const result = await send[job.kind](record);
            const accepted = result?.accepted === true || result?.sent === true;
            if (accepted) {
                const saved = await Job.updateOne({ _id: job._id, status: "processing" }, {
                    $set: { status: "sent", providerId: result.id || "", lastErrorCode: "", leaseUntil: null, completedAt: clock(), updatedAt: clock() },
                });
                if (saved.matchedCount) await updateSource(job, result, "", true);
            } else {
                await fail(job, result?.providerCode || result?.reason || "provider_error");
            }
        } catch (error) {
            await fail(job, safeErrorCode(error));
        }
        return true;
    }

    async function fail(job, code) {
        const now = clock();
        const final = job.attempts >= MAX_ATTEMPTS;
        const saved = await Job.updateOne({ _id: job._id, status: "processing" }, {
            $set: {
                status: final ? "failed" : "pending", nextAttemptAt: new Date(now.getTime() + retryDelay(job.attempts, random)),
                leaseUntil: null, lastErrorCode: code, completedAt: final ? now : null, updatedAt: now,
            },
        });
        if (saved.matchedCount) await updateSource(job, null, code, final);
    }

    async function drain(limit = 100) {
        let processed = 0;
        while (processed < limit && await processOne()) processed += 1;
        return processed;
    }

    return { claim, processOne, drain, markExhaustedLeases };
}

function safeErrorCode(error) {
    const code = typeof error?.providerCode === "string" ? error.providerCode : typeof error?.code === "string" ? error.code : "provider_error";
    return code.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60) || "provider_error";
}

let workerTimer;
let draining = false;
const defaultWorker = createNotificationWorker();

function startNotificationWorker({ intervalMs = POLL_MS } = {}) {
    if (workerTimer) return workerTimer;
    const tick = async () => {
        if (draining) return;
        draining = true;
        try { await defaultWorker.drain(); }
        catch (error) { console.error("Notification outbox polling failed.", { code: safeErrorCode(error) }); }
        finally { draining = false; }
    };
    workerTimer = setInterval(tick, intervalMs);
    workerTimer.unref?.();
    void tick();
    return workerTimer;
}

function stopNotificationWorker() {
    if (workerTimer) clearInterval(workerTimer);
    workerTimer = undefined;
}

async function resetFailedJob(kind, recordId, model = NotificationJob) {
    const _id = getJobId(kind, recordId);
    const result = await model.updateOne({ _id, status: "failed" }, {
        $set: { status: "pending", attempts: 0, nextAttemptAt: new Date(), leaseUntil: null, lastErrorCode: "", completedAt: null, updatedAt: new Date() },
    });
    return result.modifiedCount === 1;
}

module.exports = {
    JOB_KINDS, MAX_ATTEMPTS, LEASE_MS, POLL_MS, getJobId, enqueueNotification,
    enqueueSubmissionNotifications, retryDelay, createNotificationWorker,
    startNotificationWorker, stopNotificationWorker, resetFailedJob, attachAdminNotificationStatuses,
};
