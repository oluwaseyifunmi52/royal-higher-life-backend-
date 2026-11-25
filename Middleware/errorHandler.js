const errorHandler = (err, req, res, next) => {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
        console.error("Request failed", { name: err.name || "Error", code: err.code || undefined, status: err.statusCode || err.status || 500 });
    } else {
        console.error("Error:", err.message || err);
    }

    if (err.message === "Not allowed by CORS") {
        return res.status(403).json({ success: false, message: "Origin is not allowed" });
    }

    if (err.code === "CORS_ORIGIN_DENIED") {
        return res.status(403).json({
            success: false,
            message: "Origin is not allowed",
        });
    }

    // Multer file size error
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 5MB",
        });
    }

    // Multer file type error
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
            success: false,
            message: "Unexpected file field",
        });
    }

    // Multer general errors
    if (err.message && /Only (?:valid )?image file/i.test(err.message)) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            ...(isProduction ? {} : { errors: messages }),
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        return res.status(400).json({
            success: false,
            message: field ? `${field} already exists` : "A record with these details already exists.",
        });
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: isProduction ? `Invalid ${err.path}` : `Invalid ${err.path}: ${err.value}`,
        });
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            success: false,
            message: "Invalid token",
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            success: false,
            message: "Token expired",
        });
    }

    // Custom ApiError
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err.errors && err.errors.length > 0 && { errors: err.errors }),
        });
    }

    // Default server error
    const candidateStatus = Number(err.statusCode || err.status);
    const statusCode = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
        ? candidateStatus
        : 500;
    res.status(statusCode).json({
        success: false,
        message: isProduction && statusCode >= 500
            ? "Internal Server Error"
            : err.message || "Internal Server Error",
    });
};

module.exports = errorHandler;
