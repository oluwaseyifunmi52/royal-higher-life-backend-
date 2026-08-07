const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const {
    registerForEvent,
    getEventRegistrations,
    getAllRegistrations,
    cancelRegistration,
} = require("../controllers/eventRegistrationController");

router.post("/", registerForEvent);
router.get("/event/:eventId", auth, authorize("admin"), getEventRegistrations);
router.get("/", auth, authorize("admin"), getAllRegistrations);
router.put("/:id/cancel", cancelRegistration);

module.exports = router;
