const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const {
    createPartnership,
    getAllPartnerships,
    updatePartnershipStatus,
    deletePartnership,
} = require("../controllers/partnershipController");

router.post("/", createPartnership);
router.get("/", auth, authorize("admin"), getAllPartnerships);
router.put("/:id/status", auth, authorize("admin"), validateObjectId(), updatePartnershipStatus);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deletePartnership);

module.exports = router;
