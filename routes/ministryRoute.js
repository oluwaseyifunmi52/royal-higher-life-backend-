const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const {
    createMinistry,
    getMinistries,
    getMinistry,
    updateMinistry,
    deleteMinistry,
} = require("../controllers/ministryController");

const router = express.Router();

router.post("/", auth, authorize("admin"), createMinistry);

router.get("/", getMinistries);

router.get("/:id", getMinistry);

router.put("/:id", auth, authorize("admin"), updateMinistry);

router.delete("/:id", auth, authorize("admin"), deleteMinistry);

module.exports = router;
