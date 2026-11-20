const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifyWebhookSignature, hasEligiblePaystackConfiguration, initializePayment } = require("../services/paymentService");

function withSignatureEnvironment(settings = {}, callback) {
    const names = ["PAYSTACK_SECRET_KEY", "PAYSTACK_WEBHOOK_SECRET", "PAYSTACK_WEBHOOK_SECRET_PREVIOUS"];
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    for (const name of names) {
        if (Object.hasOwn(settings, name)) {
            if (settings[name] === undefined || settings[name] === null) delete process.env[name];
            else process.env[name] = settings[name];
        }
    }
    try {
        callback();
    } finally {
        for (const name of names) {
            if (previous[name] === undefined) delete process.env[name];
            else process.env[name] = previous[name];
        }
    }
}

const sign = (secret, body) => crypto.createHmac("sha512", secret).update(body).digest("hex");
const signTimestamped = (secret, timestamp, body) =>
    crypto.createHmac("sha512", secret).update(`${timestamp}.`).update(body).digest("hex");

test("Paystack legacy webhook signatures use SHA-512 and reject tampering", () => {
    withSignatureEnvironment({ PAYSTACK_SECRET_KEY: "test_secret_key", PAYSTACK_WEBHOOK_SECRET: undefined }, () => {
        const body = Buffer.from('{"event":"charge.success","data":{"reference":"RHLM-test"}}');
        const signature = sign("test_secret_key", body);
        assert.equal(verifyWebhookSignature(body, { "x-paystack-signature": signature }), true);
        assert.equal(verifyWebhookSignature(Buffer.from("altered"), { "x-paystack-signature": signature }), false);
        assert.equal(verifyWebhookSignature(body, { "x-paystack-signature": "bad" }), false);
    });
});

test("Paystack timestamped signatures reject expired timestamps", () => {
    withSignatureEnvironment({ PAYSTACK_WEBHOOK_SECRET: "whsec_test_secret" }, () => {
        const body = Buffer.from('{"event":"charge.success"}');
        const timestamp = String(Math.floor(Date.now() / 1000) - 301);
        const signature = signTimestamped("whsec_test_secret", timestamp, body);
        const header = `t=${timestamp},v1=whk_test:${signature}`;
        assert.equal(verifyWebhookSignature(body, { "paystack-signature": header }), false);
    });
});

test("modern Paystack-Signature verifies key identifiers and the raw body", () => {
    withSignatureEnvironment({ PAYSTACK_WEBHOOK_SECRET: "whsec_current_secret", PAYSTACK_WEBHOOK_SECRET_PREVIOUS: undefined }, () => {
        const body = Buffer.from('{"event":"charge.success","data":{"reference":"RHLM-modern"}}');
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = signTimestamped("whsec_current_secret", timestamp, body);
        const header = `t=${timestamp},v1=whk_current:${signature},source=paystack`;
        assert.equal(verifyWebhookSignature(body, { "paystack-signature": header }), true);
        assert.equal(verifyWebhookSignature(Buffer.from('{"event":"charge.success","amount":1}'), { "paystack-signature": header }), false);
    });
});

test("multiple Paystack-Signature values support signing-secret rotation", () => {
    withSignatureEnvironment({
        PAYSTACK_WEBHOOK_SECRET: "whsec_new_secret",
        PAYSTACK_WEBHOOK_SECRET_PREVIOUS: "whsec_old_secret",
    }, () => {
        const body = Buffer.from('{"event":"charge.success","data":{"id":"evt_rotation"}}');
        const timestamp = Math.floor(Date.now() / 1000);
        const oldSignature = signTimestamped("whsec_old_secret", timestamp, body);
        const newSignature = signTimestamped("whsec_new_secret", timestamp, body);
        const header = `t=${timestamp},v1=whk_old:${oldSignature},v1=whk_new:${newSignature}`;
        assert.equal(verifyWebhookSignature(body, { "paystack-signature": header }), true);
        const badHeader = `t=${timestamp},v1=whk_old:${"0".repeat(128)},v1=whk_new:${"0".repeat(128)}`;
        assert.equal(verifyWebhookSignature(body, { "paystack-signature": badHeader }), false);
    });
});

test("an invalid modern signature never falls back to the legacy header", () => {
    withSignatureEnvironment({
        PAYSTACK_SECRET_KEY: "test_secret_key",
        PAYSTACK_WEBHOOK_SECRET: "whsec_current_secret",
    }, () => {
        const body = Buffer.from('{"event":"charge.success"}');
        const timestamp = Math.floor(Date.now() / 1000);
        const legacySignature = sign("test_secret_key", body);
        const headers = {
            "paystack-signature": `t=${timestamp},v1=whk_current:${"0".repeat(128)}`,
            "x-paystack-signature": legacySignature,
        };
        assert.equal(verifyWebhookSignature(body, headers), false);
    });
});

test("the legacy signature is verified with the secret key, not the webhook secret", () => {
    withSignatureEnvironment({
        PAYSTACK_SECRET_KEY: undefined,
        PAYSTACK_WEBHOOK_SECRET: "whsec_current_secret",
    }, () => {
        const body = Buffer.from('{"event":"charge.success"}');
        const signature = sign("whsec_current_secret", body);
        assert.equal(verifyWebhookSignature(body, { "x-paystack-signature": signature }), false);
    });
});

test("Paystack API calls require matching account country and environment eligibility", async () => {
    const names = ["PAYSTACK_SECRET_KEY", "PAYSTACK_ACCOUNT_COUNTRY", "NODE_ENV"];
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    const restore = () => names.forEach((name) => previous[name] === undefined ? delete process.env[name] : process.env[name] = previous[name]);
    try {
        process.env.PAYSTACK_SECRET_KEY = "sk_test_0123456789abcdef";
        process.env.PAYSTACK_ACCOUNT_COUNTRY = "NG";
        process.env.NODE_ENV = "development";
        assert.equal(hasEligiblePaystackConfiguration(), true);
        process.env.PAYSTACK_SECRET_KEY = "sk_test_replace_with_your_real_test_key";
        assert.equal(hasEligiblePaystackConfiguration(), false);
        process.env.PAYSTACK_SECRET_KEY = "sk_test_0123456789abcdef";
        process.env.PAYSTACK_ACCOUNT_COUNTRY = "GH";
        assert.equal(hasEligiblePaystackConfiguration(), false);
        process.env.PAYSTACK_ACCOUNT_COUNTRY = "NG";
        process.env.NODE_ENV = "production";
        assert.equal(hasEligiblePaystackConfiguration(), false);
        await assert.rejects(initializePayment({}), { code: "PAYMENT_NOT_CONFIGURED" });
        process.env.PAYSTACK_SECRET_KEY = "sk_live_0123456789abcdef";
        assert.equal(hasEligiblePaystackConfiguration(), true);
    } finally {
        restore();
    }
});
