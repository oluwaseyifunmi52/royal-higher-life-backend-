const express = require("express");
const router = express.Router();
const {
    createDonation,
    getDonations,
    getDonationById,
    updateDonation,
    deleteDonation,
} = require("../controllers/donationController");

router.post("/", createDonation);
router.get("/", getDonations);
router.get("/:id", getDonationById);
router.put("/:id", updateDonation);
router.delete("/:id", deleteDonation);

module.exports = router;
