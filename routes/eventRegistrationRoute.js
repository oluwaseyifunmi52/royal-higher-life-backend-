const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const optionalAuth = require("../Middleware/optionalAuth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { createPublicSubmissionLimiter } = require("../Middleware/rateLimiter");
const registrationLimiter = createPublicSubmissionLimiter();
const cancellationLimiter = createPublicSubmissionLimiter();
const {
    registerForEvent,
    getEventRegistrations,
    getAllRegistrations,
    cancelRegistration,
    retryRegistrationNotification,
} = require("../controllers/eventRegistrationController");

router.post("/", registrationLimiter, registerForEvent);
router.get("/event/:eventId", auth, authorize("admin"), validateObjectId("eventId"), getEventRegistrations);
router.get("/", auth, authorize("admin"), getAllRegistrations);
router.post("/:id/retry-notification", auth, authorize("admin"), validateObjectId(), retryRegistrationNotification);
router.put("/:id/cancel", cancellationLimiter, optionalAuth, validateObjectId(), cancelRegistration);

module.exports = router;
