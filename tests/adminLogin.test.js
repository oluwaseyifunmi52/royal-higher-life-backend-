const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET ||= "isolated-admin-login-test-secret";
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../Models/user");
const mailer = require("../utils/mailer");
const { verifyToken } = require("../utils/jwt");
const authService = require("../services/authService");
const { login } = require("../controllers/authController");
const authRoutes = require("../routes/authRoute");

const originalFindOne = User.findOne;
const originalFindOneAndUpdate = User.findOneAndUpdate;
const originalFindByIdAndUpdate = User.findByIdAndUpdate;
const call = (handler, req) => new Promise((resolve, reject) => handler(req, {
    status(code) { this.code = code; return this; },
    json(body) { resolve({ code: this.code, body }); },
}, reject));

test("admin login accepts active administrators and rejects invalid or suspended credentials", async (t) => {
    t.after(() => { User.findOne = originalFindOne; });
    const password = "Strong-Passphrase-47!";
    const passwordHash = await bcrypt.hash(password, 4);
    const admin = { _id: "admin-id", email: "admin@example.test", password: passwordHash, role: "superAdmin", isActive: true, isEmailVerified: true, save: async () => {} };
    User.findOne = () => ({ select: async () => admin });
    const result = await authService.loginUser({ email: admin.email, password, adminOnly: true, loginRequestId: "test-valid-login" });
    assert.equal(result.user.role, "superAdmin");
    assert.equal(typeof result.token, "string");
    const session = verifyToken(result.token);
    assert.equal(session.id, admin._id);
    assert.equal(session.role, "superAdmin");
    admin.password = passwordHash;
    const originalWarn = console.warn;
    const diagnostics = [];
    console.warn = (_message, details) => diagnostics.push(details);
    try {
        await assert.rejects(authService.loginUser({ email: admin.email, password: "Wrong-Passphrase-47!", adminOnly: true, loginRequestId: "test-wrong-password" }), { statusCode: 401 });
        assert.equal(diagnostics.at(-1).code, "PASSWORD_MISMATCH");
    } finally {
        console.warn = originalWarn;
    }
    admin.password = passwordHash;
    admin.isActive = false;
    console.warn = (_message, details) => diagnostics.push(details);
    try {
        await assert.rejects(authService.loginUser({ email: admin.email, password, adminOnly: true, loginRequestId: "test-suspended" }), { statusCode: 401 });
        assert.equal(diagnostics.at(-1).code, "ACCOUNT_SUSPENDED");
    } finally {
        console.warn = originalWarn;
    }
});

test("admin login rejects ordinary users before issuing a token and public registration remains registered", async (t) => {
    t.after(() => { User.findOne = originalFindOne; });
    const password = "Strong-Passphrase-47!";
    const member = { _id: "member-id", email: "member@example.test", password: await bcrypt.hash(password, 4), role: "member", isActive: true, isEmailVerified: true, save: async () => { throw new Error("Admin login must reject before updating the user."); } };
    User.findOne = () => ({ select: async () => member });
    const originalWarn = console.warn;
    let diagnostic;
    console.warn = (_message, details) => { diagnostic = details; };
    try {
        await assert.rejects(call(login, { body: { adminOnly: true, email: member.email, password } }), { statusCode: 401 });
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(diagnostic.code, "ADMIN_ROLE_MISSING");
    assert.equal(diagnostic.role, "member");
    assert.equal(typeof diagnostic.requestId, "string");
    assert.equal(Object.hasOwn(diagnostic, "email"), false);
    assert.equal(Object.hasOwn(diagnostic, "password"), false);
    assert.ok(authRoutes.stack.some((layer) => layer.route?.path === "/register" && layer.route.methods.post));
});

test("missing administrator account is logged internally but keeps a generic public response", async (t) => {
    t.after(() => { User.findOne = originalFindOne; });
    User.findOne = () => ({ select: async () => null });
    const originalWarn = console.warn;
    let diagnostic;
    console.warn = (_message, details) => { diagnostic = details; };
    try {
        await assert.rejects(
            authService.loginUser({ email: "missing@example.test", password: "Any-Password-47!", adminOnly: true, loginRequestId: "test-missing-account" }),
            (error) => error.statusCode === 401 && error.message === "Invalid email or password."
        );
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(diagnostic.code, "ADMIN_NOT_FOUND");
    assert.deepEqual(Object.keys(diagnostic).sort(), ["code", "requestId"]);
    assert.equal(diagnostic.code, "ADMIN_NOT_FOUND");
});

test("invalid hashes and inactive unverified admins use distinct safe diagnostics", async (t) => {
    t.after(() => { User.findOne = originalFindOne; });
    const originalWarn = console.warn;
    const diagnostics = [];
    console.warn = (_message, details) => diagnostics.push(details);
    try {
        User.findOne = () => ({ select: async () => ({ password: "not-a-bcrypt-hash", role: "superAdmin", isActive: true, isEmailVerified: true }) });
        await assert.rejects(authService.loginUser({ email: "admin@example.test", password: "Any-Passphrase-47!", adminOnly: true, loginRequestId: "test-bad-hash" }), { statusCode: 401 });
        assert.equal(diagnostics.at(-1).code, "PASSWORD_HASH_INVALID");

        const password = "Strong-Passphrase-47!";
        User.findOne = () => ({ select: async () => ({ password: await bcrypt.hash(password, 4), role: "superAdmin", isActive: false, isEmailVerified: false }) });
        await assert.rejects(authService.loginUser({ email: "admin@example.test", password, adminOnly: true, loginRequestId: "test-inactive" }), { statusCode: 401 });
        assert.equal(diagnostics.at(-1).code, "ACCOUNT_INACTIVE");

        User.findOne = () => ({ select: async () => ({ password: await bcrypt.hash(password, 4), role: "superAdmin", isActive: true, isEmailVerified: true, save: async () => { throw new Error("simulated save failure"); } }) });
        await assert.rejects(authService.loginUser({ email: "admin@example.test", password, adminOnly: true, loginRequestId: "test-session-failure" }), { statusCode: 500 });
        assert.equal(diagnostics.at(-1).code, "SESSION_CREATION_FAILED");
        assert.deepEqual(Object.keys(diagnostics.at(-1)).sort(), ["code", "errorType", "requestId", "stage"]);
    } finally {
        console.warn = originalWarn;
    }
});

test("password recovery atomically consumes the hashed OTP, hashes the new password and invalidates sessions", async (t) => {
    t.after(() => {
        User.findOneAndUpdate = originalFindOneAndUpdate;
        mailer.sendPasswordChangedEmail = originalSendPasswordChangedEmail;
    });
    const otp = "128904";
    const password = "Recovered-Admin-Password-47!";
    const updatedUser = { _id: "admin-id", updatedAt: new Date() };
    const originalSendPasswordChangedEmail = mailer.sendPasswordChangedEmail;
    let captured;
    User.findOneAndUpdate = async (filter, update, options) => {
        captured = { filter, update, options };
        return updatedUser;
    };
    mailer.sendPasswordChangedEmail = async () => ({ sent: true });

    assert.equal(await authService.resetPassword({ code: otp, password, confirmPassword: password }), true);
    assert.equal(captured.filter.otp, crypto.createHash("sha256").update(otp).digest("hex"));
    assert.notEqual(captured.filter.otp, otp);
    assert.ok(captured.filter.otpExpires.$gt instanceof Date);
    assert.equal(captured.filter.otpAttempts.$lt, 5);
    assert.equal(await bcrypt.compare(password, captured.update.$set.password), true);
    assert.equal(captured.update.$set.otp, null);
    assert.equal(captured.update.$set.otpExpires, null);
    assert.equal(captured.update.$inc.tokenVersion, 1);
    assert.equal(captured.options.new, true);
});

test("expired or reused password-reset OTP is rejected without updating the account", async (t) => {
    t.after(() => { User.findOneAndUpdate = originalFindOneAndUpdate; });
    User.findOneAndUpdate = async () => null;
    await assert.rejects(
        authService.resetPassword({ code: "128904", password: "Recovered-Admin-Password-47!", confirmPassword: "Recovered-Admin-Password-47!" }),
        (error) => error.statusCode === 400 && error.message === "Invalid or expired reset code."
    );
});

test("password reset request and redemption routes both use the reset limiter", () => {
    for (const path of ["/forgot-password", "/reset-password"]) {
        const route = authRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods.post)?.route;
        assert.ok(route, `${path} should be registered`);
        assert.equal(route.stack.length, 2, `${path} should include limiter and controller`);
    }
});

test("logout invalidates existing administrator tokens by incrementing tokenVersion", async (t) => {
    t.after(() => { User.findByIdAndUpdate = originalFindByIdAndUpdate; });
    User.findByIdAndUpdate = async (id, update) => {
        assert.equal(id, "admin-id");
        assert.deepEqual(update, { $inc: { tokenVersion: 1 } });
        return { _id: id };
    };
    assert.equal(await authService.logoutUser("admin-id"), true);
});

test("existing email verification activates direct-created administrators", async (t) => {
    t.after(() => { User.findOne = originalFindOne; });
    const token = "verification-token-for-admin";
    const user = { role: "contentAdmin", isActive: false, isEmailVerified: false, otp: "stored-hash", otpExpires: new Date(Date.now() + 60_000), save: async () => {} };
    User.findOne = (filter) => {
        assert.equal(filter.$or[0].otp, require("crypto").createHash("sha256").update(token).digest("hex"));
        return Promise.resolve(user);
    };
    await authService.verifyEmail({ token });
    assert.equal(user.isEmailVerified, true);
    assert.equal(user.isActive, true);
    assert.equal(user.otp, null);
});
