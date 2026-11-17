const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const {
    registerVolunteer,
    getAllVolunteers,
    updateVolunteerStatus,
    deleteVolunteer,
    retryVolunteerNotification,
} = require("../controllers/volunteerController");

router.post("/", registerVolunteer);
router.get("/", auth, authorize("admin"), getAllVolunteers);
router.post("/:id/retry-notification", auth, authorize("admin"), validateObjectId(), retryVolunteerNotification);
router.put("/:id/status", auth, authorize("admin"), validateObjectId(), updateVolunteerStatus);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteVolunteer);

module.exports = router;
