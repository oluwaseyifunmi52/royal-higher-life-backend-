const { test } = require("node:test");
const assert = require("node:assert/strict");
const NotificationJob = require("../Models/notificationJob");
const PrayerRequest = require("../Models/prayerRequest");
const Contact = require("../Models/contact");
const authorize = require("../Middleware/authorize");
const { getAllPrayerRequests, getPrayerRequestById, retryPrayerNotification } = require("../controllers/prayerController");
const { getContacts, retryContactNotification } = require("../controllers/contactController");
const { getJobId } = require("../services/notificationOutbox");

function invoke(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { resolve({ status: this.statusCode, body }); return this; },
        };
        handler(req, res, reject);
    });
}

test("admin lists retain submission records and references while exposing durable queue states", async (t) => {
    const prayer = {
        _id: "prayer-record", reference: "RHL-PRY-123", name: "Confidential visitor", request: "Private prayer details",
        status: "praying", createdAt: new Date("2026-11-20T00:00:00.000Z"), notificationStatus: "pending", isPrivate: true,
    };
    const contact = {
        _id: "contact-record", reference: "RHL-CON-456", name: "Visitor", message: "Contact details",
        status: "unread", createdAt: new Date("2026-11-21T00:00:00.000Z"), notificationStatus: "failed",
    };
    const originals = { prayerFind: PrayerRequest.find, prayerById: PrayerRequest.findById, contactFind: Contact.find, jobFind: NotificationJob.find };
    PrayerRequest.find = () => ({ sort: async () => [prayer] });
    PrayerRequest.findById = async (id) => id === prayer._id ? prayer : null;
    Contact.find = () => ({ sort: async () => [contact] });
    NotificationJob.find = ({ _id: { $in: ids } }) => ({
        select() { return this; },
        lean: async () => [
            { _id: getJobId("prayer-admin", prayer._id), status: "processing" },
            { _id: getJobId("contact-admin", contact._id), status: "failed" },
        ].filter((job) => ids.includes(job._id)),
    });
    t.after(() => {
        PrayerRequest.find = originals.prayerFind;
        PrayerRequest.findById = originals.prayerById;
        Contact.find = originals.contactFind;
        NotificationJob.find = originals.jobFind;
    });

    const prayers = await invoke(getAllPrayerRequests, { query: {} });
    const contacts = await invoke(getContacts, { query: {} });
    const detail = await invoke(getPrayerRequestById, { params: { id: prayer._id } });

    assert.equal(prayers.body.data[0].reference, prayer.reference);
    assert.equal(prayers.body.data[0].status, "praying");
    assert.equal(prayers.body.data[0].createdAt.toISOString(), prayer.createdAt.toISOString());
    assert.equal(prayers.body.data[0].notificationQueueStatus, "processing");
    assert.equal(prayers.body.data[0].request, prayer.request);
    assert.equal(contacts.body.data[0].reference, contact.reference);
    assert.equal(contacts.body.data[0].createdAt.toISOString(), contact.createdAt.toISOString());
    assert.equal(contacts.body.data[0].notificationQueueStatus, "failed");
    assert.equal(detail.body.data.request, prayer.request);
    assert.equal(detail.body.data.notificationQueueStatus, "processing");
});

test("existing admin roles retain scoped prayer and contact access; ordinary users are denied", () => {
    for (const route of ["/api/prayers", "/api/contacts"]) {
        for (const role of ["admin", "superAdmin", "ministryAdmin"]) {
            let passed = false;
            authorize("admin")({ user: { role }, baseUrl: route, route: { path: "/" } }, {}, () => { passed = true; });
            assert.equal(passed, true, `${role} can access ${route}`);
        }
        let statusCode;
        authorize("admin")({ user: { role: "member" }, baseUrl: route, route: { path: "/" } }, {
            status(code) { statusCode = code; return this; },
            json() {},
        }, () => assert.fail("ordinary user must be denied"));
        assert.equal(statusCode, 403);
    }
});

test("admin notification state mapping covers Pending, Processing, Sent and Failed", async () => {
    const { attachAdminNotificationStatuses } = require("../services/notificationOutbox");
    const states = ["pending", "processing", "sent", "failed"];
    const records = states.map((state, index) => ({ _id: `prayer-${index}`, notificationStatus: "pending" }));
    const jobs = records.map((record, index) => ({ _id: getJobId("prayer-admin", record._id), status: states[index] }));
    const Job = { find: () => ({ select() { return this; }, lean: async () => jobs }) };
    const result = await attachAdminNotificationStatuses("prayer", records, Job);
    assert.deepEqual(result.map((record) => record.notificationQueueStatus), states);
});

test("authorized prayer and contact retry handlers requeue failed jobs without resending inline", async (t) => {
    const prayer = { _id: "prayer-retry", reference: "RHL-PRY-RETRY", notificationStatus: "failed", async save() {} };
    const contact = { _id: "contact-retry", reference: "RHL-CON-RETRY", notificationStatus: "failed", async save() {} };
    const jobs = new Map();
    const originals = {
        prayerById: PrayerRequest.findById, contactById: Contact.findById,
        jobUpdate: NotificationJob.updateOne, jobFindById: NotificationJob.findById,
    };
    PrayerRequest.findById = async (id) => id === prayer._id ? prayer : null;
    Contact.findById = async (id) => id === contact._id ? contact : null;
    NotificationJob.updateOne = async ({ _id, status }, update, options = {}) => {
        let job = jobs.get(_id);
        if (!job && options.upsert) {
            job = { ...update.$setOnInsert };
            jobs.set(_id, job);
            return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        if (!job || (status && job.status !== status)) return { matchedCount: 0, modifiedCount: 0 };
        Object.assign(job, update.$set || {});
        return { matchedCount: 1, modifiedCount: 1 };
    };
    NotificationJob.findById = (id) => ({ lean: async () => jobs.get(id) || null });
    t.after(() => {
        PrayerRequest.findById = originals.prayerById;
        Contact.findById = originals.contactById;
        NotificationJob.updateOne = originals.jobUpdate;
        NotificationJob.findById = originals.jobFindById;
    });
    for (const [handler, kind, record] of [
        [retryPrayerNotification, "prayer-admin", prayer],
        [retryContactNotification, "contact-admin", contact],
    ]) {
        const id = getJobId(kind, record._id);
        jobs.set(id, { _id: id, kind, recordId: record._id, status: "failed", attempts: 8 });
        const response = await invoke(handler, { params: { id: record._id } });
        assert.equal(response.status, 202);
        assert.equal(jobs.get(id).status, "pending");
        assert.equal(response.body.data.reference, record.reference);
        assert.equal(record.notificationStatus, "pending");
    }
});

