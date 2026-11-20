require("dotenv").config();

// Configure the Node.js DNS resolver FIRST, before express or any module that
// loads mongoose/the MongoDB driver. mongodb+srv SRV/TXT lookups use Node's
// c-ares resolver, which is broken by default on this machine
// (ECONNREFUSED/querySrv against a dead 127.0.0.1 stub) — PowerShell's Windows
// DNS client works, Node's does not, without this override.
const { applyDnsOverride } = require("./Config/dns");
applyDnsOverride();

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./Config/db");
const { corsMiddleware } = require("./Config/cors");
const { cloudinary } = require("./Config/cloudinary");
const { authLimiter, publicSubmissionLimiter, webhookLimiter, passwordResetLimiter, uploadLimiter } = require("./Middleware/rateLimiter");
const { verifyEmailTransport } = require("./Config/email");

// Routes
const authRoutes = require("./routes/authRoute");
const reviewRoutes = require("./routes/reviewRoute");
const contactRoutes = require("./routes/contactRoute");
const donationRoutes = require("./routes/donationRoute");
const eventRoutes = require("./routes/eventRoute");
const galleryRoutes = require("./routes/galleryRoute");
const prayerRoutes = require("./routes/prayerRoute");
const sermonRoutes = require("./routes/sermonRoute");
const ministryRoutes = require("./routes/ministryRoute");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoute");
const userRoutes = require("./routes/userRoute");
const calendarRoutes = require("./routes/calendarRoute");
const newsletterRoutes = require("./routes/newsletterRoute");
const eventRegistrationRoutes = require("./routes/eventRegistrationRoute");
const volunteerRoutes = require("./routes/volunteerRoute");
const partnershipRoutes = require("./routes/partnershipRoute");
const announcementRoutes = require("./routes/announcementRoute");
const leadershipRoutes = require("./routes/leadershipRoute");
const siteContentRoutes = require("./routes/siteContentRoute");

// Middlewares
const notFound = require("./Middleware/notFound");
const errorHandler = require("./Middleware/errorHandler");

const app = express();
// Render terminates TLS and forwards one trusted proxy hop. Keep client-IP based limits accurate.
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
const PORT = process.env.PORT || 8000;

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: "deny" },
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb", verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(corsMiddleware);

app.get("/health", (req, res) => {
    const cloudinaryConfigured = [
        process.env.CLOUDINARY_CLOUD_NAME,
        process.env.CLOUDINARY_API_KEY,
        process.env.CLOUDINARY_API_SECRET,
    ].every((value) => typeof value === "string" && value.trim().length > 0);
    res.status(200).json({
        success: true,
        message: "Royal HigherLife Backend is running",
        cloudinaryConfigured,
    });
});

app.get("/", (req, res) => {
    res.status(200).json({ message: "Royal HigherLife API is running" });
});

// Apply rate limiting to specific routes
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
// Backward-compatible auth aliases must share the same brute-force limits.
app.use("/api/users/register", authLimiter);
app.use("/api/users/login", authLimiter);
app.use("/api/auth/verify-email", authLimiter);
app.use("/api/auth/resend-otp", authLimiter);
app.use("/api/auth/forgot-password", passwordResetLimiter);
app.use("/api/auth/reset-password", passwordResetLimiter);
app.use("/api/auth/admin-login", authLimiter);

app.use("/api/reviews", publicSubmissionLimiter);
app.use("/api/contacts", publicSubmissionLimiter);
app.use("/api/prayers", publicSubmissionLimiter);
// Signed Paystack webhooks must not consume the low public submission quota.
app.use("/api/donations/webhook/paystack", webhookLimiter);
app.use("/api/donations", (req, res, next) => {
    if (req.path.replace(/\/$/, "") === "/webhook/paystack") return next();
    return publicSubmissionLimiter(req, res, next);
});
app.use("/api/event-registrations", publicSubmissionLimiter);
app.use("/api/volunteers", publicSubmissionLimiter);
app.use("/api/partnerships", publicSubmissionLimiter);
app.use("/api/newsletter", publicSubmissionLimiter);
app.post("/api/gallery", uploadLimiter);
app.put("/api/gallery/:id", uploadLimiter);
app.put("/api/auth/profile-image", uploadLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/prayers", prayerRoutes);
app.use("/api/sermons", sermonRoutes);
app.use("/api/ministries", ministryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/event-registrations", eventRegistrationRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/partnerships", partnershipRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/leadership", leadershipRoutes);
app.use("/api/site-content", siteContentRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();

        // Verify SMTP transporter at startup. A failed check logs a diagnostic
        // but does not prevent the Express application from starting.
        try {
            const smtpCheck = await verifyEmailTransport();
            if (smtpCheck.verified) {
                console.info("SMTP ready.");
            } else {
                console.error("SMTP ERROR:", smtpCheck.reason || "SMTP verification failed.", {
                    provider: smtpCheck.provider,
                    ...(smtpCheck.providerCode ? { providerCode: smtpCheck.providerCode } : {}),
                    ...(smtpCheck.providerStatus ? { providerStatus: smtpCheck.providerStatus } : {}),
                });
            }
        } catch (smtpError) {
            console.error("SMTP ERROR:", smtpError?.message || smtpError?.name || "SMTP verification threw an unexpected error.");
        }

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error(`Server startup aborted: ${error.message}`);
        process.exitCode = 1;
    }
};

startServer();

module.exports = app;
