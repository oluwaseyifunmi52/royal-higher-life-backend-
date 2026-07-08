const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUris = [process.env.MONGO_URI, process.env.MONGO_URI_2 || "mongodb://127.0.0.1:27017/royal-backend"].filter(Boolean);

    let lastError = null;

    for (const mongoUri of mongoUris) {
        try {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
                autoIndex: true,
            });

            console.log(`MongoDB connected successfully using ${mongoUri}`);
            return;
        } catch (error) {
            lastError = error;
            console.warn(`MongoDB connection failed for ${mongoUri}: ${error.message}`);
        }
    }

    console.error("MongoDB connection failed for all configured URIs:", lastError?.message || "unknown error");
};

module.exports = { connectDB };
