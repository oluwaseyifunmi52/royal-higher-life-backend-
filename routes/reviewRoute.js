const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const router = express.Router();
const {
    createReview,
    retryTestimonyNotification,
    getAllReviews,
    getAllReviewsAdmin,
    getReviewById,
    updateReview,
    deleteReview,
} = require("../controllers/reviewController");

// Public: Submit testimonial
router.post("/", createReview);

// Public: Get approved testimonials only
router.get("/", getAllReviews);
router.get("/admin/all", auth, authorize("admin"), getAllReviewsAdmin);
router.post("/:id/retry-notification", auth, authorize("admin"), validateObjectId(), retryTestimonyNotification);
router.get("/:id", validateObjectId(), getReviewById);

// Admin only: Update, delete testimonials
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateReview);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteReview);

module.exports = router;
