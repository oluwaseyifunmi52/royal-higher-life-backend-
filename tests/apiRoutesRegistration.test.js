const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET ||= "isolated-api-route-registration-test-secret";
const authRoutes = require("../routes/authRoute");
const siteContentRoutes = require("../routes/siteContentRoute");

const findRoute = (router, path, method) => router.stack.find((layer) =>
    layer.route?.path === path && layer.route.methods[method]);

test("admin login is registered as POST /api/auth/admin-login", () => {
    assert.ok(findRoute(authRoutes, "/admin-login", "post"));
});

test("public site content is registered as GET /api/site-content", () => {
    assert.ok(findRoute(siteContentRoutes, "/", "get"));
});
