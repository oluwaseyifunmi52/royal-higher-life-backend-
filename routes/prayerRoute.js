const express = require("express");
const router = express.Router();
const {
    createPrayerRequest,
    getAllPrayerRequests,
    getPrayerRequestById,
    updatePrayerRequest,
    deletePrayerRequest,
} = require("../controllers/prayerController");

router.post("/", createPrayerRequest);
router.get("/", getAllPrayerRequests);
router.get("/:id", getPrayerRequestById);
router.put("/:id", updatePrayerRequest);
router.delete("/:id", deletePrayerRequest);

module.exports = router;
