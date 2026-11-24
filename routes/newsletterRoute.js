const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { createPublicSubmissionLimiter } = require("../Middleware/rateLimiter");
const {
    subscribe,
    getAllSubscribers,
    unsubscribe,
} = require("../controllers/newsletterController");
const subscriptionLimiter = createPublicSubmissionLimiter();
const unsubscribeLimiter = createPublicSubmissionLimiter();

router.post("/", subscriptionLimiter, subscribe);
router.get("/", auth, authorize("admin"), getAllSubscribers);
router.put("/unsubscribe", unsubscribeLimiter, unsubscribe);

module.exports = router;
