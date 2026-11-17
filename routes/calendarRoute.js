const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const {
    getCalendarEvents,
    createCalendarEvent
} = require("../controllers/calendarController");

const router = express.Router();

// Public calendar
router.get("/", getCalendarEvents);

// Admin create event
router.post("/", auth, authorize("admin"), createCalendarEvent);

module.exports = router;
