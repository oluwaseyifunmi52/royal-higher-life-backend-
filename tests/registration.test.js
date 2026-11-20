const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "unit-test-secret-not-for-production";

// Keep email delivery local and offline for these tests: no provider
// credentials are present, so the mailer reports "not_configured" instead of
// contacting Gmail or Resend.
process.env.EMAIL_PROVIDER = "gmail-smtp";
process.env.EMAIL_USER = "";
process.env.EMAIL_PASS = "";
delete process.env.RESEND_API_KEY;

const User = require("../Models/user");
const mailer = require("../utils/mailer");
const authService = require("../services/authService");

const originalFindOne = User.findOne;
const originalCreate = User.create;
const originalSendVerificationEmail = mailer.sendVerificationEmail;

afterEach(() => {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    mailer.sendVerificationEmail = originalSendVerificationEmail;
});

function makeUser(fields = {}) {
    const doc = {
        _id: "64b000000000000000000001",
        isEmailVerified: false,
        otp: null,
        otpExpires: null,
        ...fields,
    };
    doc.toObject = () => {
        const copy = { ...doc };
        delete copy.toObject;
        delete copy.save;
        return copy;
    };
    doc.save = async () => doc;
    return doc;
}

const validPayload = () => ({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada.lovelace@example.com",
    phone: "+2348012345678",
    country: "Nigeria",
    state: "Lagos",
    gender: "Female",
    newsletter: true,
    password: "Sup3rSecret!",
    confirmPassword: "Sup3rSecret!",
});

test("duplicate email is reported with an actionable message and creates nothing", async () => {
    let createCalled = false;
    User.findOne = async () => makeUser({ email: "ada.lovelace@example.com" });
    User.create = async () => {
        createCalled = true;
        return makeUser();
    };

    await assert.rejects(
        () => authService.registerUser(validPayload()),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /already exists/i);
            assert.match(error.message, /signing in/i);
            return true;
        }
    );
    assert.equal(createCalled, false, "no account may be written for a duplicate email");
});

test("invalid email is rejected before any database write", async () => {
    let createCalled = false;
    User.create = async () => {
        createCalled = true;
        return makeUser();
    };

    await assert.rejects(
        () => authService.registerUser({ ...validPayload(), email: "not-an-email" }),
        (error) => error.statusCode === 400 && /Enter valid account details/i.test(error.message)
    );
    assert.equal(createCalled, false);
});

test("short password is rejected before any database write", async () => {
    let createCalled = false;
    User.create = async () => {
        createCalled = true;
        return makeUser();
    };

    await assert.rejects(
        () => authService.registerUser({ ...validPayload(), password: "short", confirmPassword: "short" }),
        (error) => error.statusCode === 400 && /8 and 128 characters/i.test(error.message)
    );
    assert.equal(createCalled, false);
});

test("missing phone is rejected before any database write", async () => {
    let createCalled = false;
    User.create = async () => {
        createCalled = true;
        return makeUser();
    };

    await assert.rejects(
        () => authService.registerUser({ ...validPayload(), phone: "" }),
        (error) => error.statusCode === 400 && /Enter valid account details/i.test(error.message)
    );
    assert.equal(createCalled, false);
});

test("mismatched passwords are rejected before any database write", async () => {
    await assert.rejects(
        () => authService.registerUser({ ...validPayload(), confirmPassword: "Different1!" }),
        (error) => error.statusCode === 400 && /Passwords do not match/i.test(error.message)
    );
});

test("registration succeeds when the email provider is unavailable", async () => {
    let created = null;
    User.findOne = async () => null;
    User.create = async (data) => {
        created = data;
        return makeUser({ email: data.email, firstName: data.firstName, lastName: data.lastName });
    };
    // Real mailer with no credentials: returns { sent: false } without throwing.
    mailer.sendVerificationEmail = async () => ({ sent: false, reason: "not_configured" });

    const result = await authService.registerUser(validPayload());

    assert.equal(result.verificationEmailSent, false);
    assert.ok(result.user, "the account itself must be returned as created");
    assert.ok(created, "the account must be persisted");
    assert.notEqual(created.password, "Sup3rSecret!", "password must be stored hashed");
    assert.match(created.password, /^\$2[aby]\$/);
    assert.equal(typeof created.otp, "string");
    assert.notEqual(created.otp, "Sup3rSecret!");
    assert.ok(Date.now() < new Date(created.otpExpires).getTime(), "verification code must expire");
});

test("a throwing mailer never fails an already-created account", async () => {
    User.findOne = async () => null;
    User.create = async (data) => makeUser({ email: data.email });
    mailer.sendVerificationEmail = async () => {
        throw new Error("SMTP connection refused");
    };

    const result = await authService.registerUser(validPayload());

    assert.equal(result.verificationEmailSent, false);
    assert.ok(result.user, "account must survive an email delivery failure");
});

test("successful email delivery is reported as sent", async () => {
    User.findOne = async () => null;
    User.create = async (data) => makeUser({ email: data.email });
    mailer.sendVerificationEmail = async () => ({ sent: true, id: "message-1" });

    const result = await authService.registerUser(validPayload());
    assert.equal(result.verificationEmailSent, true);
});

test("a concurrent duplicate key on create is reported as a duplicate account", async () => {
    User.findOne = async () => null;
    User.create = async () => {
        const error = new Error("E11000 duplicate key error");
        error.code = 11000;
        error.keyValue = { email: "ada.lovelace@example.com" };
        throw error;
    };
    mailer.sendVerificationEmail = async () => ({ sent: true });

    await assert.rejects(
        () => authService.registerUser(validPayload()),
        (error) => error.statusCode === 400 && /already exists/i.test(error.message)
    );
});

test("email verification marks the account verified exactly once", async () => {
    const user = makeUser({ isEmailVerified: false });
    User.findOne = async () => user;

    const first = await authService.verifyEmail({ token: "verification-token-value" });
    assert.equal(first, true);
    assert.equal(user.isEmailVerified, true);
    assert.equal(user.otp, null);
    assert.equal(user.otpExpires, null);

    // A second attempt must find no matching unverified record.
    User.findOne = async () => null;
    await assert.rejects(
        () => authService.verifyEmail({ token: "verification-token-value" }),
        (error) => error.statusCode === 400 && /Invalid or expired verification link/i.test(error.message)
    );
    assert.equal(user.isEmailVerified, true, "an account is never un-verified");
});

test("resend verification stays silent for unknown addresses", async () => {
    User.findOne = async () => null;
    let sendCalled = false;
    mailer.sendVerificationEmail = async () => {
        sendCalled = true;
        return { sent: true };
    };

    assert.equal(await authService.resendOTP("nobody@example.com"), true);
    assert.equal(sendCalled, false, "no email is sent when no unverified account matches");
});
