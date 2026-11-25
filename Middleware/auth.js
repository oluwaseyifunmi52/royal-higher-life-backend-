const jwt = require("jsonwebtoken");
const User = require("../Models/user");

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided.",
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found.",
            });
        }

        if (!user.isActive || Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
            return res.status(401).json({ success: false, message: "Session expired or account is unavailable. Please sign in again." });
        }

        req.user = user;

        next();

    } catch (error) {

        if (process.env.NODE_ENV !== "production") {
            console.error("Authentication Error:", error.name || "AuthenticationError");
        }

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }
};

module.exports = auth;
