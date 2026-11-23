const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    MAX_ATTEMPTS, LEASE_MS, enqueueNotification, createNotificationWorker, resetFailedJob,
} = require("../services/notificationOutbox");

function createFakeStore() {
    const jobs = new Map();
    const records = new Map();
    const matches = (job, filter) => {
        if (filter._id && job._id !== filter._id) return false;
        if (filter.status && job.status !== filter.status) return false;
        if (filter.attempts?.$lt !== undefined && !(job.attempts < filter.attempts.$lt)) return false;
        if (filter.attempts?.$gte !== undefined && !(job.attempts >= filter.attempts.$gte)) return false;
        if (filter.$or) return filter.$or.some((part) => matches(job, part));
        if (filter.nextAttemptAt?.$lte && !(job.nextAttemptAt <= filter.nextAttemptAt.$lte)) return false;
        if (filter.leaseUntil?.$lte && !(job.leaseUntil && job.leaseUntil <= filter.leaseUntil.$lte)) return false;
        return true;
    };
    const Job = {
        async updateOne(filter, update, options = {}) {
            let job = jobs.get(filter._id);
            if (!job && options.upsert) {
                job = { ...update.$setOnInsert };
                jobs.set(filter._id, job);
                return { matchedCount: 0, upsertedCount: 1 };
            }
            if (!job || !matches(job, filter)) return { matchedCount: 0, modifiedCount: 0 };
            Object.assign(job, update.$set || {});
            for (const [key, value] of Object.entries(update.$inc || {})) job[key] = (job[key] || 0) + value;
            return { matchedCount: 1, modifiedCount: 1 };
        },
        async findOneAndUpdate(filter, update) {
            const job = [...jobs.values()].filter((candidate) => matches(candidate, filter)).sort((a, b) => a.createdAt - b.createdAt)[0];
            if (!job) return null;
            Object.assign(job, update.$set || {});
            for (const [key, value] of Object.entries(update.$inc || {})) job[key] = (job[key] || 0) + value;
            return { ...job };
        },
        find(filter) { return { lean: async () => [...jobs.values()].filter((job) => matches(job, filter)).map((job) => ({ ...job })) }; },
        async exists(filter) { return jobs.has(filter._id); },
        async findById(id) { return jobs.has(id) ? { ...jobs.get(id) } : null; },
    };
    const Source = {
        async findById(id) { return records.get(String(id)) || null; },
        async updateOne() { return { matchedCount: 1 }; },
    };
    return { jobs, records, Job, Source };
}

test("an expired processing lease is recovered after a worker restart without resending twice", async () => {
    const { jobs, records, Job, Source } = createFakeStore();
    let now = new Date(Date.now() + 1_000);
    records.set("prayer-1", { id: "prayer-1", _id: "prayer-1", email: "test@example.com", name: "Visitor", reference: "RHL-PRY-1", createdAt: now });
    const id = await enqueueNotification("prayer-confirmation", "prayer-1", Job);
    const crashedWorker = createNotificationWorker({
        Job, PrayerRequest: Source, Contact: Source, clock: () => now,
        send: { "prayer-confirmation": async () => { throw new Error("should not send before simulated crash"); } },
    });
    const claimed = await crashedWorker.claim();
    assert.equal(claimed.status, "processing");
    assert.equal(claimed.attempts, 1);

    now = new Date(now.getTime() + LEASE_MS + 1);
    let sends = 0;
    const restartedWorker = createNotificationWorker({
        Job, PrayerRequest: Source, Contact: Source, clock: () => now,
        send: { "prayer-confirmation": async () => { sends += 1; return { accepted: true, id: "provider-1" }; } },
    });
    await restartedWorker.processOne();
    assert.equal(jobs.get(id).status, "sent");
    assert.equal(sends, 1);
    await restartedWorker.drain();
    assert.equal(sends, 1);
});

test("failed email attempts are retried with a limit and end in a terminal failure", async () => {
    const { jobs, records, Job, Source } = createFakeStore();
    let now = new Date(Date.now() + 1_000);
    records.set("contact-1", { id: "contact-1", _id: "contact-1", email: "test@example.com", name: "Visitor", reference: "RHL-CON-1", createdAt: now });
    const id = await enqueueNotification("contact-admin", "contact-1", Job);
    const worker = createNotificationWorker({
        Job, PrayerRequest: Source, Contact: Source, clock: () => now, random: () => 0.5,
        send: { "contact-admin": async () => ({ accepted: false, reason: "network_error" }) },
        updateSource: async () => {},
    });
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        await worker.processOne();
        const job = jobs.get(id);
        assert.equal(job.attempts, attempt);
        if (attempt < MAX_ATTEMPTS) {
            assert.equal(job.status, "pending");
            now = new Date(job.nextAttemptAt);
        }
    }
    assert.equal(jobs.get(id).status, "failed");
    assert.equal(jobs.get(id).attempts, MAX_ATTEMPTS);
});

test("administrator retry reuses the same failed job and a sent job cannot be queued twice", async () => {
    const { jobs, records, Job, Source } = createFakeStore();
    let now = new Date(Date.now() + 1_000);
    records.set("contact-2", { id: "contact-2", _id: "contact-2", email: "test@example.com", name: "Visitor", reference: "RHL-CON-2", createdAt: now });
    const id = await enqueueNotification("contact-admin", "contact-2", Job);
    let sends = 0;
    const worker = createNotificationWorker({
        Job, PrayerRequest: Source, Contact: Source, clock: () => now,
        send: { "contact-admin": async () => { sends += 1; return { accepted: true, id: "provider-2" }; } },
        updateSource: async () => {},
    });
    jobs.get(id).status = "failed";
    assert.equal(await resetFailedJob("contact-admin", "contact-2", Job), true);
    assert.equal(jobs.size, 1);
    await worker.processOne();
    assert.equal(jobs.get(id).status, "sent");
    assert.equal(await resetFailedJob("contact-admin", "contact-2", Job), false);
    assert.equal(jobs.size, 1);
    assert.equal(jobs.get(id).status, "sent");
    assert.equal(await worker.processOne(), false);
    assert.equal(sends, 1);
});
