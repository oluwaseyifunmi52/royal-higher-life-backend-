require("dotenv").config();

const { connectDB } = require("../Config/db");
const User = require("../Models/user");
const OAuthTransaction = require("../Models/oauthTransaction");

async function migrateSocialAuthIndexes() {
    await connectDB({ autoIndex: false });
    const userCollection = User.collection;
    const indexes = await userCollection.indexes();
    const phoneIndex = indexes.find((index) =>
        Object.keys(index.key || {}).length === 1 && index.key.phone === 1
    );

    const duplicatePhone = await userCollection.aggregate([
        { $match: { phone: { $type: "string", $ne: "" } } },
        { $group: { _id: "$phone", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
    ]).next();
    if (duplicatePhone) {
        throw new Error("Social-auth index migration stopped: duplicate existing phone values must be resolved first.");
    }

    if (phoneIndex && !(phoneIndex.unique && phoneIndex.sparse)) {
        await userCollection.dropIndex(phoneIndex.name);
    }
    if (!phoneIndex || !(phoneIndex.unique && phoneIndex.sparse)) {
        await userCollection.createIndex({ phone: 1 }, { unique: true, sparse: true, name: "phone_1" });
    }

    await userCollection.createIndex(
        { provider: 1, providerId: 1 },
        {
            unique: true,
            partialFilterExpression: { providerId: { $type: "string" } },
            name: "provider_1_providerId_1",
        }
    );

    await OAuthTransaction.createCollection().catch((error) => {
        if (error.codeName !== "NamespaceExists") throw error;
    });
    await OAuthTransaction.collection.createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_1" });
    await OAuthTransaction.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_1" });
}

migrateSocialAuthIndexes()
    .then(async () => {
        console.info("Social-auth indexes are ready. Existing user records were not modified.");
        await require("mongoose").disconnect();
    })
    .catch(async (error) => {
        console.error("Social-auth index migration failed.", { code: error.code || error.name });
        await require("mongoose").disconnect();
        process.exitCode = 1;
    });
