import express from "express";
import auth from "../Middleware/auth.js";
import adminMiddleware from "../Middleware/adminMiddleware.js";
import { getDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

// Admin dashboard (protected)
router.get(
    "/",
    auth,
    adminMiddleware,
    getDashboard
);

export default router;