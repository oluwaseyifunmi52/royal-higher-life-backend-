require("dotenv").config();

const { connectDB } = require("../Config/db");
const NotificationJob = require("../Models/notificationJob");

const INDEXES = [
    { key: { status: 1, nextAttemptAt: 1, createdAt: 1 }, name: "notification_jobs_due" },
    { key: { status: 1, leaseUntil: 1, attempts: 1 }, name: "notification_jobs_expired_lease" },
];

function sameKey(left, right) {
    return JSON.stringify(Object.entries(left)) === JSON.stringify(Object.entries(right));
}

async function migrate() {
    await connectDB({ autoIndex: false });
    const collection = NotificationJob.collection;
    let existing = [];
    try {
        existing = await collection.listIndexes().toArray();
    } catch (error) {
        if (error?.code !== 26 && error?.codeName !== "NamespaceNotFound") throw error;
    }

    console.log("Existing notification outbox indexes:", existing.map(({ name, key, unique, sparse }) => ({ name, key, unique: Boolean(unique), sparse: Boolean(sparse) })));
    const operations = [];
    for (const planned of INDEXES) {
        const nameConflict = existing.find((index) => index.name === planned.name && !sameKey(index.key, planned.key));
        if (nameConflict) throw new Error(`Index name conflict for ${planned.name}; no indexes were created.`);
        const sameSpec = existing.find((index) => sameKey(index.key, planned.key));
        if (sameSpec && (sameSpec.unique || sameSpec.partialFilterExpression)) {
            throw new Error(`Conflicting index options for ${planned.name}; no indexes were created.`);
        }
        if (!sameSpec) operations.push({ key: planned.key, name: planned.name });
    }
    console.log("Proposed createIndexes operations:", operations);

    if (!process.argv.includes("--apply")) {
        console.log("Dry run only. Pass --apply after explicit production approval to create missing indexes.");
        return;
    }
    if (process.env.ALLOW_NOTIFICATION_INDEX_MIGRATION !== "true") {
        throw new Error("Index creation requires ALLOW_NOTIFICATION_INDEX_MIGRATION=true after separate approval.");
    }
    if (operations.length) await collection.createIndexes(operations);
    console.log("Notification outbox indexes are ready.");
}

migrate()
    .catch((error) => {
        console.error("Notification outbox index migration stopped safely.", { code: error?.code || error?.name || "migration_error" });
        process.exitCode = 1;
    })
    .finally(async () => {
        const mongoose = require("mongoose");
        await mongoose.disconnect();
    });
