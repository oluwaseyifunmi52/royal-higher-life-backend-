const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifyWebhookSignature } = require("../services/paymentService");

test("Paystack legacy webhook signatures use SHA-512 and reject tampering", () => {
    const previous = process.env.PAYSTACK_SECRET_KEY;
    const previousWebhook = process.env.PAYSTACK_WEBHOOK_SECRET;
    process.env.PAYSTACK_SECRET_KEY = "test_secret_key";
    delete process.env.PAYSTACK_WEBHOOK_SECRET;
    const body = Buffer.from('{"event":"charge.success","data":{"reference":"RHLM-test"}}');
    const signature = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");
    assert.equal(verifyWebhookSignature(body, { "x-paystack-signature": signature }), true);
    assert.equal(verifyWebhookSignature(Buffer.from("altered"), { "x-paystack-signature": signature }), false);
    assert.equal(verifyWebhookSignature(body, { "x-paystack-signature": "bad" }), false);
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = previous;
    if (previousWebhook === undefined) delete process.env.PAYSTACK_WEBHOOK_SECRET; else process.env.PAYSTACK_WEBHOOK_SECRET = previousWebhook;
});

test("Paystack timestamped signatures reject expired timestamps", () => {
    const previous = process.env.PAYSTACK_WEBHOOK_SECRET;
    process.env.PAYSTACK_WEBHOOK_SECRET = "webhook_secret";
    const body = Buffer.from('{"event":"charge.success"}');
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const signature = crypto.createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
    assert.equal(verifyWebhookSignature(body, { "paystack-signature": `t=${timestamp},v1=${signature}` }), false);
    if (previous === undefined) delete process.env.PAYSTACK_WEBHOOK_SECRET; else process.env.PAYSTACK_WEBHOOK_SECRET = previous;
});
