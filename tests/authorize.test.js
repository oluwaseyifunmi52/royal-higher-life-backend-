const { test } = require("node:test");
const assert = require("node:assert/strict");
const authorize = require("../Middleware/authorize");

function check(role, baseUrl, routePath = "/", requiredRoles = ["admin"]) {
    const req = { user: { role }, baseUrl, route: { path: routePath } };
    let status = 200; let body;
    const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
    let passed = false;
    authorize(...requiredRoles)(req, res, () => { passed = true; });
    return { passed, status, body };
}

test("legacy and super administrators retain full admin route access", () => {
    assert.equal(check("admin", "/api/donations").passed, true);
    assert.equal(check("superAdmin", "/api/donations").passed, true);
});

test("content and media administrator roles stay within their backend scopes", () => {
    assert.equal(check("contentAdmin", "/api/sermons").passed, true);
    assert.equal(check("contentAdmin", "/api/donations").passed, false);
    assert.equal(check("mediaAdmin", "/api/gallery").passed, true);
    assert.equal(check("mediaAdmin", "/api/sermons").passed, false);
    assert.equal(check("ministryAdmin", "/api/prayers").passed, true);
    assert.equal(check("ministryAdmin", "/api/users").passed, false);
});

test("administrator account management requires the Super Admin role", () => {
    assert.equal(check("superAdmin", "/api/admin", "/administrators", ["superAdmin"]).passed, true);
    assert.equal(check("admin", "/api/admin", "/administrators", ["superAdmin"]).passed, false);
    assert.equal(check("contentAdmin", "/api/admin", "/administrators", ["superAdmin"]).passed, false);
    assert.equal(check("member", "/api/admin", "/administrators", ["superAdmin"]).passed, false);
});
