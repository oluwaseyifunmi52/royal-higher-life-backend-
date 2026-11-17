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

router.post("/webhook/paystack", paystackWebhook);
router.get("/campaigns", listCampaigns);
router.get("/currencies", getDonationCurrencies);
router.get("/campaigns/manage", auth, authorize("admin"), listCampaignsAdmin);
router.post("/verify", verifyDonation);
router.post("/track/request", requestDonationTracking);
router.post("/track/confirm", confirmDonationTracking);
router.post("/", optionalAuth, createDonation);
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
