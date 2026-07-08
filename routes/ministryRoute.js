const express = require("express");
const {
    createMinistry,
    getMinistries,
    getMinistry,
    updateMinistry,
    deleteMinistry,
} = require("../controllers/ministry.Controller");

const router = express.Router();

router.post("/", createMinistry);

router.get("/", getMinistries);

router.get("/:id", getMinistry);

router.put("/:id", updateMinistry);

router.delete("/:id", deleteMinistry);

module.exports = router;
