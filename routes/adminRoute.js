const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { getOverview } = require("../controllers/adminController");

const router = express.Router();

router.get("/overview", auth, authorize("admin"), getOverview);
router.get("/stats", auth, authorize("admin"), getOverview);

module.exports = router;
