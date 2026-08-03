const express = require("express");
const auth = require("../Middleware/auth");
const adminMiddleware = require("../Middleware/adminMiddleware");
const {
    getCalendarEvents,
    createCalendarEvent
} = require("../controllers/calendarController");

const router = express.Router();

// Public calendar
router.get("/", getCalendarEvents);

// Admin create event
router.post("/", auth, adminMiddleware, createCalendarEvent);

module.exports = router;
