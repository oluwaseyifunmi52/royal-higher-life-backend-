const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUris = [
        process.env.MONGO_URI,
        process.env.MONGO_URI_2 || "mongodb://127.0.0.1:27017/royal-backend",
    ].filter(Boolean);

    let lastError = null;

    for (const mongoUri of mongoUris) {
        try {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
                autoIndex: process.env.NODE_ENV === "development",
            });

            if (process.env.NODE_ENV === "development") {
                console.log(`✅ MongoDB connected successfully.`);
                console.log(`📂 Database: ${mongoose.connection.name}`);
                console.log(`🌐 Host: ${mongoose.connection.host}`);
            } else {
                console.log("✅ MongoDB connected.");
            }

            return;
        } catch (error) {
            lastError = error;

            if (process.env.NODE_ENV === "development") {
                console.warn(`❌ Failed to connect to ${mongoUri}`);
                console.warn(error.message);
            }
        }
    }

    console.error("❌ Unable to connect to MongoDB.");

    if (process.env.NODE_ENV === "development" && lastError) {
        console.error(lastError);
    }

    process.exit(1);
};

module.exports = { connectDB };
