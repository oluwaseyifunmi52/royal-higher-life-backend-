const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { getPublicSiteContent, getAdminSiteContent, updateSiteContent } = require("../controllers/siteContentController");

const router = express.Router();
router.get("/", getPublicSiteContent);
router.get("/admin", auth, authorize("admin"), getAdminSiteContent);
router.put("/", auth, authorize("admin"), updateSiteContent);
module.exports = router;
