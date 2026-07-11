import express from "express";
import auth from "../middleware/auth.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
    getCalendarEvents,
    createCalendarEvent
} from "../controllers/calendarController.js";

const router = express.Router();

// Public calendar
router.get(
    "/",
    getCalendarEvents
);

// Admin create event
router.post(
    "/",
    auth,
    adminMiddleware,
    createCalendarEvent
);

export default router;