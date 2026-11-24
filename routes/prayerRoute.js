const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { createPublicSubmissionLimiter } = require("../Middleware/rateLimiter");
const router = express.Router();
const submissionLimiter = createPublicSubmissionLimiter();
const {
    createPrayerRequest,
    retryPrayerNotification,
    getAllPrayerRequests,
    getPrayerRequestById,
    updatePrayerRequest,
    deletePrayerRequest,
} = require("../controllers/prayerController");

// Public: Submit prayer request
router.post("/", submissionLimiter, createPrayerRequest);

// Admin only: List, view, update, delete prayer requests
router.get("/", auth, authorize("admin"), getAllPrayerRequests);
router.post("/:id/retry-notification", auth, authorize("admin"), validateObjectId(), retryPrayerNotification);
router.get("/:id", auth, authorize("admin"), validateObjectId(), getPrayerRequestById);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updatePrayerRequest);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deletePrayerRequest);

module.exports = router;
