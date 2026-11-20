const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const router = express.Router();
const {
    createEvent,
    getAllEvents,
    getAllEventsAdmin,
    getEventById,
    updateEvent,
    deleteEvent,
} = require("../controllers/eventController");

router.post("/", auth, authorize("admin"), createEvent);
router.get("/admin/all", auth, authorize("admin"), getAllEventsAdmin);
router.get("/", getAllEvents);
router.get("/:id", validateObjectId(), getEventById);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateEvent);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteEvent);

module.exports = router;
