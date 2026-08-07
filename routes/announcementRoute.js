const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const {
    createAnnouncement,
    getAllAnnouncements,
    getAnnouncementById,
    deleteAnnouncement,
} = require("../controllers/announcementController");

router.post("/", auth, authorize("admin"), createAnnouncement);
router.get("/", getAllAnnouncements);
router.get("/:id", getAnnouncementById);
router.delete("/:id", auth, authorize("admin"), deleteAnnouncement);

module.exports = router;
