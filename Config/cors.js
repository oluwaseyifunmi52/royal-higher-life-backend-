const cors = require("cors");

const DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4000",
    "https://royal-higher-life-9ttr.vercel.app",
    "https://royal-higher-life-v9tt.vercel.app",
    "https://royal-higher-life-backend-2o66.onrender.com",
];

const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

const allowedOrigins = [...new Set([...DEFAULT_ORIGINS, ...configuredOrigins])];

const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

const corsMiddleware = cors(corsOptions);

module.exports = { corsMiddleware, corsOptions };
