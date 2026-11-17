const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const {
    getPublicLeadership,
    getAllLeadership,
    createLeadership,
    updateLeadership,
    deleteLeadership,
} = require("../controllers/leadershipController");

const router = express.Router();

router.get("/", getPublicLeadership);
router.get("/admin/all", auth, authorize("admin"), getAllLeadership);
router.post("/", auth, authorize("admin"), createLeadership);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateLeadership);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteLeadership);

module.exports = router;
