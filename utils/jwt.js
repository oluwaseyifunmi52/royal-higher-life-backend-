const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "14d";

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required.");
}

if (Buffer.byteLength(JWT_SECRET, "utf8") < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes.");
}

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            tokenVersion: user.tokenVersion || 0,
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
            algorithm: "HS256",
        }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
};

const signToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn,
        algorithm: "HS256",
    });
};

module.exports = {
    generateToken,
    verifyToken,
    signToken,
};
