const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../Models/user");
const OAuthTransaction = require("../Models/oauthTransaction");
const express = require("express");

test("social accounts can be stored without inventing a password or phone number", async () => {
    const user = new User({
        firstName: "Test",
        lastName: "Member",
        email: "test.member@example.com",
        provider: "google",
        providerId: "google-subject-123",
        isEmailVerified: true,
    });

    await assert.doesNotReject(user.validate());
    assert.equal(user.role, "member");
    assert.equal(user.password, undefined);
    assert.equal(user.phone, undefined);
});

test("email and password accounts still require a password and phone number", async () => {
    const user = new User({
        firstName: "Test",
        lastName: "Member",
        email: "test.member@example.com",
        provider: "local",
    });
    await assert.rejects(user.validate(), (error) => {
        assert.ok(error.errors.password);
        assert.ok(error.errors.phone);
        return true;
    });
});

test("OAuth transactions use hashed tokens, purpose and expiration", async () => {
    const state = new OAuthTransaction({
        purpose: "state",
        tokenHash: "a".repeat(64),
        provider: "google",
        nonce: "n".repeat(32),
        expiresAt: new Date(Date.now() + 60_000),
    });

    await assert.doesNotReject(state.validate());
    assert.equal(state.tokenHash.length, 64);
});

test("unconfigured providers return safe 503 responses instead of exposing credentials", async () => {
    process.env.JWT_SECRET ||= "test-only-social-auth-secret";
    const envKeys = [
        "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL",
        "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_CALLBACK_URL", "FRONTEND_URL",
    ];
    const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];

    const socialAuthRoute = require("../routes/socialAuthRoute");
    const app = express();
    app.use("/api/auth/social", socialAuthRoute);
    const server = app.listen(0, "127.0.0.1");

    try {
        await new Promise((resolve) => server.once("listening", resolve));
        const address = server.address();
        for (const provider of ["google", "facebook"]) {
            const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/social/${provider}`);
            const body = await response.json();
            assert.equal(response.status, 503);
            assert.match(body.message, /not configured/i);
            assert.equal(JSON.stringify(body).includes("secret"), false);
        }
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        for (const key of envKeys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
});
