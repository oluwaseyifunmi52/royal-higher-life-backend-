const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const router = express.Router();
const {
    createDonation,
    getDonations,
    getDonationById,
    updateDonation,
    deleteDonation,
} = require("../controllers/donationController");

router.post("/", createDonation);
router.get("/", auth, authorize("admin"), getDonations);
router.get("/:id", auth, authorize("admin"), getDonationById);
router.put("/:id", auth, authorize("admin"), updateDonation);
router.delete("/:id", auth, authorize("admin"), deleteDonation);

module.exports = router;
