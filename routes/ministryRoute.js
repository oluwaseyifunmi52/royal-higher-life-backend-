const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
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

router.get("/:id", validateObjectId(), getMinistry);

router.put("/:id", auth, authorize("admin"), validateObjectId(), updateMinistry);

router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteMinistry);

module.exports = router;
