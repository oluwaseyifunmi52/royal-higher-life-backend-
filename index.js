import "dotenv/config";

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);


import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { connectDB } from "./Config/db.js";
import { corsMiddleware } from "./Config/cors.js";
import { cloudinary } from "./Config/cloudinary.js";

// Routes
import authRoutes from "./routes/authRoute.js";
import reviewRoutes from "./routes/reviewRoute.js";
import contactRoutes from "./routes/contactRoute.js";
import donationRoutes from "./routes/donationRoute.js";
import eventRoutes from "./routes/eventRoute.js";
import galleryRoutes from "./routes/galleryRoute.js";
import prayerRoutes from "./routes/prayerRoute.js";
import sermonRoutes from "./routes/sermonRoute.js";
import ministryRoutes from "./routes/ministryRoute.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import calendarRoutes from "./routes/calendarRoute.js";


// Middlewares
import notFound from "./Middleware/notFound.js";
import errorHandler from "./Middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(helmet());
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

app.use("/api/auth", authRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/prayers", prayerRoutes);
app.use("/api/sermons", sermonRoutes);
app.use("/api/ministries", ministryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use(notFound);
app.use(errorHandler);
app.use("/api/calendar", calendarRoutes);


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

export default app;
