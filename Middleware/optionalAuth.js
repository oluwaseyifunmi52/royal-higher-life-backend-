const jwt = require("jsonwebtoken");
const User = require("../Models/user");

module.exports = async function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    try {
        const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) req.user = user;
    } catch { /* guest donations remain available without a valid session */ }
    return next();
};
