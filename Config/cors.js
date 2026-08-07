const cors = require("cors");

const DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:5174",
    "https://royal-higher-life-9ttr.vercel.app",
    "https://royal-higher-life-v9tt.vercel.app",
];

const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

const allowedOrigins = [...new Set([...DEFAULT_ORIGINS, ...configuredOrigins])];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
};

const corsMiddleware = cors(corsOptions);

module.exports = { corsMiddleware, corsOptions, allowedOrigins };
