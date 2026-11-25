const jwt = require("jsonwebtoken");
const User = require("../Models/user");

module.exports = async function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    try {
        const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ["HS256"] });
        const user = await User.findById(decoded.id);
        if (user?.isActive && Number(decoded.tokenVersion || 0) === Number(user.tokenVersion || 0)) req.user = user;
    } catch { /* guest donations remain available without a valid session */ }
    return next();
};
