const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { getOverview } = require("../controllers/adminController");
const { listAdminUsers, createAdminUser, updateAdminDetails, updateAdminUserRole, setAdminStatus, revokeAdminAccess } = require("../controllers/adminUsersController");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { listAdminAudit } = require("../controllers/adminAuditController");
const { authLimiter } = require("../Middleware/rateLimiter");

const router = express.Router();

router.get("/overview", auth, authorize("admin"), getOverview);
router.get("/stats", auth, authorize("admin"), getOverview);
const superAdmin = [auth, authorize("superAdmin")];
router.get("/administrators", ...superAdmin, listAdminUsers);
router.get("/audit", ...superAdmin, listAdminAudit);
router.post("/administrators", ...superAdmin, authLimiter, createAdminUser);
router.put("/administrators/:id/details", ...superAdmin, validateObjectId("id"), updateAdminDetails);
router.put("/administrators/:id/role", ...superAdmin, validateObjectId("id"), updateAdminUserRole);
router.put("/administrators/:id/:action", ...superAdmin, validateObjectId("id"), setAdminStatus);
router.delete("/administrators/:id", ...superAdmin, validateObjectId("id"), revokeAdminAccess);

module.exports = router;
