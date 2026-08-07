const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const router = express.Router();
const {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
} = require("../controllers/eventController");

router.post("/", auth, authorize("admin"), createEvent);
router.get("/", getAllEvents);
router.get("/:id", getEventById);
router.put("/:id", auth, authorize("admin"), updateEvent);
router.delete("/:id", auth, authorize("admin"), deleteEvent);

module.exports = router;
