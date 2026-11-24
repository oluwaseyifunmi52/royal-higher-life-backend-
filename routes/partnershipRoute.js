const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { createPublicSubmissionLimiter } = require("../Middleware/rateLimiter");
const submissionLimiter = createPublicSubmissionLimiter();
const {
    createPartnership,
    getAllPartnerships,
    updatePartnershipStatus,
    deletePartnership,
} = require("../controllers/partnershipController");

router.post("/", submissionLimiter, createPartnership);
router.get("/", auth, authorize("admin"), getAllPartnerships);
router.put("/:id/status", auth, authorize("admin"), validateObjectId(), updatePartnershipStatus);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deletePartnership);

module.exports = router;
