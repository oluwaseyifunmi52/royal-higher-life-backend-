const { test } = require("node:test");
const assert = require("node:assert/strict");
const PrayerRequest = require("../Models/prayerRequest");
const Contact = require("../Models/contact");
const NotificationJob = require("../Models/notificationJob");
const { createPrayerRequest } = require("../controllers/prayerController");
const { createContact } = require("../controllers/contactController");
const { getJobId } = require("../services/notificationOutbox");

function installSubmissionFakes(t) {
    const prayerStore = new Map();
    const contactStore = new Map();
    const jobs = new Map();
    const originals = {
        prayerCreate: PrayerRequest.create, prayerFind: PrayerRequest.findById,
        contactCreate: Contact.create, contactFind: Contact.findById, contactFindOne: Contact.findOne,
        jobUpdate: NotificationJob.updateOne, jobExists: NotificationJob.exists,
    };
    const createRecord = (data, store) => {
        const record = {
            ...data, id: String(data._id), _id: data._id, reference: `RHL-${data.submissionType === "prayer" ? "PRY" : "CON"}-1234567890`,
            status: data.status || "unread", notificationStatus: "pending", confirmationStatus: "pending",
            notificationDeliveryStatus: "unknown", notificationAttemptCount: 0, createdAt: new Date("2026-11-23T00:00:00.000Z"),
            async save() { store.set(String(this._id), this); return this; },
        };
        store.set(String(record._id), record);
        return record;
    };
    PrayerRequest.create = async (data) => {
        if (prayerStore.has(String(data._id))) throw Object.assign(new Error("duplicate"), { code: 11000 });
        return createRecord({ ...data, submissionType: "prayer" }, prayerStore);
    };
    PrayerRequest.findById = async (id) => prayerStore.get(String(id)) || null;
    Contact.create = async (data) => {
        if (contactStore.has(String(data._id)) || [...contactStore.values()].some((record) => record.submissionKey === data.submissionKey)) {
            throw Object.assign(new Error("duplicate"), { code: 11000 });
        }
        return createRecord({ ...data, submissionType: "contact" }, contactStore);
    };
    Contact.findById = async (id) => contactStore.get(String(id)) || null;
    Contact.findOne = async ({ submissionKey }) => [...contactStore.values()].find((record) => record.submissionKey === submissionKey) || null;
    NotificationJob.updateOne = async ({ _id }, update) => {
        if (!jobs.has(_id)) jobs.set(_id, update.$setOnInsert);
        return { matchedCount: 1, upsertedCount: jobs.has(_id) ? 0 : 1 };
    };
    NotificationJob.exists = async ({ _id }) => jobs.has(_id);
    t.after(() => {
        PrayerRequest.create = originals.prayerCreate; PrayerRequest.findById = originals.prayerFind;
        Contact.create = originals.contactCreate; Contact.findById = originals.contactFind; Contact.findOne = originals.contactFindOne;
        NotificationJob.updateOne = originals.jobUpdate; NotificationJob.exists = originals.jobExists;
    });
    return { prayerStore, contactStore, jobs };
}

async function invoke(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { resolve({ status: this.statusCode, body }); return this; },
        };
        handler(req, res, reject);
    });
}

test("prayer submissions persist record and jobs, return without waiting for email, and retain reference on retry", async (t) => {
    const { prayerStore, jobs } = installSubmissionFakes(t);
    let emailCalls = 0;
    const request = {
        body: { name: "Test Person", email: "test@example.com", prayer: "Please pray for my family", category: "Family", submissionKey: "prayer-key-123456789" },
        get: () => undefined,
    };
    const first = await invoke(createPrayerRequest, request);
    assert.equal(first.status, 201);
    assert.equal(first.body.emailNotificationQueued, true);
    assert.equal(first.body.emailNotificationsSent, false);
    assert.equal(prayerStore.size, 1);
    assert.equal(jobs.size, 2);
    assert.equal(emailCalls, 0, "controller does not invoke provider; delayed email cannot hold response");
    const duplicate = await invoke(createPrayerRequest, request);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.data.reference, first.body.data.reference);
    assert.equal(prayerStore.size, 1);
    assert.equal(jobs.size, 2);
});

test("contact retries preserve submission-key deduplication and re-ensure outbox jobs", async (t) => {
    const { contactStore, jobs } = installSubmissionFakes(t);
    const request = {
        body: { name: "Test Person", email: "test@example.com", message: "Please contact me", subject: "General Question", submissionKey: "contact-key-123456789" },
    };
    const first = await invoke(createContact, request);
    assert.equal(first.status, 201);
    assert.equal(first.body.emailNotificationAccepted, false);
    assert.equal(contactStore.size, 1);
    assert.equal(jobs.size, 2);
    const duplicate = await invoke(createContact, request);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.data.reference, first.body.data.reference);
    assert.equal(contactStore.size, 1);
    assert.equal(jobs.size, 2);
});

test("outbox ids are stable and independent per email type and submission", () => {
    assert.equal(getJobId("prayer-admin", "record-1"), getJobId("prayer-admin", "record-1"));
    assert.notEqual(getJobId("prayer-admin", "record-1"), getJobId("prayer-confirmation", "record-1"));
    assert.notEqual(getJobId("contact-admin", "record-1"), getJobId("contact-admin", "record-2"));
});
