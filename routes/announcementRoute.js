const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const {
    createAnnouncement,
    getAllAnnouncements,
    getAnnouncementById,
    deleteAnnouncement,
    getAllAnnouncementsAdmin,
    updateAnnouncement,
} = require("../controllers/announcementController");

router.post("/", auth, authorize("admin"), createAnnouncement);
router.get("/admin/all", auth, authorize("admin"), getAllAnnouncementsAdmin);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateAnnouncement);
router.get("/", getAllAnnouncements);
router.get("/:id", validateObjectId(), getAnnouncementById);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteAnnouncement);

module.exports = router;
