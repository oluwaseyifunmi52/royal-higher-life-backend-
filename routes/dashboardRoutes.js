const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { getDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", auth, authorize("admin"), getDashboard);

module.exports = router;
