const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const {
    registerVolunteer,
    getAllVolunteers,
    updateVolunteerStatus,
    deleteVolunteer,
} = require("../controllers/volunteerController");

router.post("/", registerVolunteer);
router.get("/", auth, authorize("admin"), getAllVolunteers);
router.put("/:id/status", auth, authorize("admin"), updateVolunteerStatus);
router.delete("/:id", auth, authorize("admin"), deleteVolunteer);

module.exports = router;
