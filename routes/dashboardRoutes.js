const express = require("express");
const auth = require("../Middleware/auth");
const adminMiddleware = require("../Middleware/adminMiddleware");
const { getDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", auth, adminMiddleware, getDashboard);

module.exports = router;
