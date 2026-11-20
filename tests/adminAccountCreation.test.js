const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET ||= "isolated-admin-account-test-secret";
const bcrypt = require("bcryptjs");
const User = require("../Models/user");
const crypto = require("crypto");
const mailer = require("../utils/mailer");
const audit = require("../services/adminAuditService");
const originalSendVerification = mailer.sendVerificationEmail;
let verificationToken;
mailer.sendVerificationEmail = async (_user, token) => { verificationToken = token; return { sent: true }; };
const originalAuditRecord = audit.recordAdminAction;
let auditArgs;
audit.recordAdminAction = async (...args) => { auditArgs = args; };
const { createAdminUser, updateAdminDetails } = require("../controllers/adminUsersController");
const original = { exists: User.exists, create: User.create, findOne: User.findOne };
const call = (handler, req) => new Promise((resolve, reject) => handler(req, {
    status(code) { this.code = code; return this; },
    json(body) { resolve({ code: this.code, body }); },
}, reject));
const validInput = { fullName: "Ada Example", email: "ada@example.test", password: "Strong-Passphrase-47!", confirmPassword: "Strong-Passphrase-47!", role: "contentAdmin" };

test("Super Admin direct account creation validates, hashes, waits for email verification and audits", async (t) => {
    t.after(() => { User.exists = original.exists; User.create = original.create; });
    auditArgs = undefined;
    t.after(() => { audit.recordAdminAction = originalAuditRecord; });
    let created;
    User.exists = async () => false;
    User.create = async (data) => { created = { ...data, _id: "created-admin-id" }; return created; };

    const response = await call(createAdminUser, { body: validInput, user: { _id: "root-id", role: "superAdmin" } });
    assert.equal(response.code, 201);
    assert.equal(created.firstName, "Ada");
    assert.equal(created.lastName, "Example");
    assert.equal(created.role, "contentAdmin");
    assert.equal(created.isActive, false);
    assert.equal(created.isEmailVerified, false);
    assert.equal(created.otp, crypto.createHash("sha256").update(verificationToken).digest("hex"));
    assert.notEqual(created.otp, verificationToken);
    assert.notEqual(created.password, validInput.password);
    assert.equal(await bcrypt.compare(validInput.password, created.password), true);
    assert.equal(auditArgs[1], "administrator.create");

    for (const role of ["superAdmin", "mediaAdmin"]) {
        User.create = async (data) => ({ ...data, _id: "created-admin-id" });
        const createdResponse = await call(createAdminUser, { body: { ...validInput, role }, user: { _id: "root-id", role: "superAdmin" } });
        assert.equal(createdResponse.code, 201);
        assert.equal(createdResponse.body.data.role, role);
        assert.equal(createdResponse.body.data.verificationEmailSent, true);
    }
});

test("direct account creation rejects duplicate email, weak or mismatched passwords and unsupported roles", async (t) => {
    t.after(() => { User.exists = original.exists; User.create = original.create; });
    User.exists = async () => true;
    await assert.rejects(call(createAdminUser, { body: validInput, user: { role: "superAdmin" } }), { statusCode: 409 });
    User.exists = async () => false;
    await assert.rejects(call(createAdminUser, { body: { ...validInput, password: "weak", confirmPassword: "weak" }, user: { role: "superAdmin" } }), { statusCode: 400 });
    await assert.rejects(call(createAdminUser, { body: { ...validInput, confirmPassword: "Other-Passphrase-47!" }, user: { role: "superAdmin" } }), { statusCode: 400 });
    await assert.rejects(call(createAdminUser, { body: { ...validInput, role: "ministryAdmin" }, user: { role: "superAdmin" } }), { statusCode: 400 });
});

test("Super Admin can edit administrator details and changing email requires verification", async (t) => {
    t.after(() => { User.findOne = original.findOne; User.exists = original.exists; });
    const admin = { _id: "existing-admin-id", firstName: "Ada", lastName: "Example", email: "ada@example.test", role: "mediaAdmin", isEmailVerified: true, isActive: true, save: async () => {} };
    User.findOne = () => ({ select: async () => admin });
    User.exists = async () => false;
    const response = await call(updateAdminDetails, { params: { id: admin._id }, body: { fullName: "Ada Lovelace", email: "ada.lovelace@example.test" }, user: { _id: "root-id", role: "superAdmin" } });
    assert.equal(response.code, 200);
    assert.equal(admin.firstName, "Ada");
    assert.equal(admin.lastName, "Lovelace");
    assert.equal(admin.email, "ada.lovelace@example.test");
    assert.equal(admin.isEmailVerified, false);
    assert.equal(admin.isActive, false);
    assert.equal(typeof admin.otp, "string");
    assert.equal(response.body.data.verificationEmailSent, true);
});

test("only the protected Super Admin router exposes direct administrator creation", () => {
    const router = require("../routes/adminRoute");
    const route = router.stack.find((layer) => layer.route?.path === "/administrators" && layer.route.methods.post);
    assert.ok(route);
    assert.equal(route.route.stack[0].name, "auth");
    const authorization = route.route.stack[1].handle;
    let deniedStatus;
    let nextCalled = false;
    authorization({ user: { role: "contentAdmin" }, baseUrl: "/api/admin", route: { path: "/administrators" } }, { status(code) { deniedStatus = code; return this; }, json() {} }, () => { nextCalled = true; });
    assert.equal(deniedStatus, 403);
    assert.equal(nextCalled, false);
    assert.equal(typeof route.route.stack[2].handle, "function");
    assert.equal(route.route.stack.length, 4);
    const updateRoute = router.stack.find((layer) => layer.route?.path === "/administrators/:id/details" && layer.route.methods.put);
    assert.ok(updateRoute);
    assert.equal(updateRoute.route.stack[0].name, "auth");
    const authRoutes = require("../routes/authRoute");
    assert.equal(authRoutes.stack.some((layer) => String(layer.route?.path || "").includes("admin-invitation")), false);
});
