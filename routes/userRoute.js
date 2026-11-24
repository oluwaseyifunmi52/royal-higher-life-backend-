const express = require("express");
const auth = require("../Middleware/auth");
const authorize = require("../Middleware/authorize");
const { validateObjectId } = require("../Middleware/validateObjectId");
const { registrationLimiter, loginLimiter } = require("../Middleware/rateLimiter");
const {
    register,
    login,
    getUsers,
    getUser,
    updateUser,
    deleteUser,
} = require("../controllers/userController");

const router = express.Router();

// Public authentication routes (kept for backward compatibility - frontend uses /api/auth)
router.post("/register", registrationLimiter, register);
router.post("/login", loginLimiter, login);

// Protected admin routes
router.get("/", auth, authorize("admin"), getUsers);
router.get("/:id", auth, authorize("admin"), validateObjectId(), getUser);
router.put("/:id", auth, authorize("admin"), validateObjectId(), updateUser);
router.delete("/:id", auth, authorize("admin"), validateObjectId(), deleteUser);

module.exports = router;
