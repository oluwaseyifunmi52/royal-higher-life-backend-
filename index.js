require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./Config/db");
const { corsMiddleware } = require("./Config/cors");
const { cloudinary } = require("./Config/cloudinary");

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

// Middlewares
const notFound = require("./Middleware/notFound");
const errorHandler = require("./Middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(corsMiddleware);

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Royal HigherLife Backend is running",
        cloudinaryConfigured: Boolean(cloudinary?.config?.cloud_name),
    });
});

app.get("/", (req, res) => {
    res.status(200).json({ message: "Royal HigherLife API is running" });
});

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

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error(error);
    }
};

startServer();

module.exports = app;
