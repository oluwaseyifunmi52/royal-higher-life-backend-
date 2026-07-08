 const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "14d";

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment variables.");
}

/**
 * Generate JWT Access Token
 * @param {Object} payload
 * @returns {String}
 */
const signToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

/**
 * Verify JWT Token
 * @param {String} token
 * @returns {Object}
 */
const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

/**
 * Decode JWT without verification
 * Useful for debugging only
 * @param {String} token
 * @returns {Object|null}
 */
const decodeToken = (token) => {
    return jwt.decode(token);
};

module.exports = {
    signToken,
    verifyToken,
    decodeToken,
};