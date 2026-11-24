const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const optionalAuth = require("../Middleware/optionalAuth");
const { validateObjectId } = require("../Middleware/validateObjectId");
const router = express.Router();
const {
    createDonation,
    verifyDonation,
    paystackWebhook,
    requestDonationTracking,
    confirmDonationTracking,
    retryDonationReceipt,
    getMyDonations,
    getDonationAudit,
    getDonationCurrencies,
    getDonations,
    getDonationById,
    updateDonation,
    deleteDonation,
} = require("../controllers/donationController");
const { listCampaigns, listCampaignsAdmin, createCampaign, updateCampaign, deactivateCampaign } = require("../controllers/campaignController");
const { createPublicSubmissionLimiter, webhookLimiter } = require("../Middleware/rateLimiter");
const donationLimiter = createPublicSubmissionLimiter();
const verificationLimiter = createPublicSubmissionLimiter();
const trackingRequestLimiter = createPublicSubmissionLimiter();
const trackingConfirmationLimiter = createPublicSubmissionLimiter();

router.post("/webhook/paystack", webhookLimiter, paystackWebhook);
router.get("/campaigns", listCampaigns);
router.get("/currencies", getDonationCurrencies);
router.get("/campaigns/manage", auth, authorize("admin"), listCampaignsAdmin);
router.post("/verify", verificationLimiter, verifyDonation);
router.post("/track/request", trackingRequestLimiter, requestDonationTracking);
router.post("/track/confirm", trackingConfirmationLimiter, confirmDonationTracking);
router.post("/", donationLimiter, optionalAuth, createDonation);
router.get("/mine", auth, getMyDonations);
router.get("/audit", auth, authorize("admin"), getDonationAudit);
router.post("/:id/retry-receipt", auth, authorize("admin"), validateObjectId(), retryDonationReceipt);
router.get("/", auth, authorize("admin"), getDonations);
router.get("/:id", auth, authorize("admin"), validateObjectId(), getDonationById);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateDonation);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteDonation);
router.post("/campaigns", auth, authorize("admin"), createCampaign);
router.put("/campaigns/:id", auth, authorize("admin"), validateObjectId(), updateCampaign);
router.delete("/campaigns/:id", auth, authorize("admin"), validateObjectId(), deactivateCampaign);

module.exports = router;
