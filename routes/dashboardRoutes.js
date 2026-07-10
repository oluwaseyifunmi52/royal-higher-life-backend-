import express from "express";

import auth from "../Middleware/auth.js";
import adminMiddleware from "../Middleware/adminMiddleware.js";

import {
    getDashboard
} from "../Controllers/dashboardController.js";


const router = express.Router();


router.get(
    "/",
    auth,
    adminMiddleware,
    getDashboard
);


export default router;