const authorize = (...roles) => {
    return (req, res, next) => {
        const role = req.user?.role;
        const routeScope = `${req.baseUrl || ""}${req.route?.path || ""}`;
        const scopedRoles = {
            contentAdmin: ["/api/sermons", "/api/events", "/api/ministries", "/api/gallery", "/api/announcements", "/api/reviews", "/api/leadership", "/api/site-content"],
            mediaAdmin: ["/api/gallery"],
            ministryAdmin: ["/api/ministries", "/api/events", "/api/volunteers", "/api/partnerships", "/api/prayers", "/api/contacts", "/api/event-registrations"],
        };
        const legacyOrSuperAdmin = roles.includes("admin") && ["admin", "superAdmin"].includes(role);
        const scopedAccess = roles.includes("admin") && scopedRoles[role]?.some((prefix) => routeScope.startsWith(prefix));
        if (!req.user || (!legacyOrSuperAdmin && !roles.includes(role) && !scopedAccess)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to access this resource.",
            });
        }

        next();
    };
};

module.exports = authorize;
