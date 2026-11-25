const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const {
    createDonation,
    paystackWebhook,
    getDonationCurrencies,
    hasConfiguredNgnPaymentProvider,
    getConfiguredDonationProviderIds,
} = require("../controllers/donationController");
const paymentService = require("../services/paymentService");
const Donation = require("../Models/donation");
const DonationAudit = require("../Models/donationAudit");
const donationRoutes = require("../routes/donationRoute");
const { corsMiddleware, corsOptions } = require("../Config/cors");

const VALID_TEST_KEY = "sk_test_0123456789abcdef";

async function withPaystackEnvironment(settings = {}, callback) {
    const previous = {
        key: process.env.PAYSTACK_SECRET_KEY,
        country: process.env.PAYSTACK_ACCOUNT_COUNTRY,
        nodeEnv: process.env.NODE_ENV,
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
        previousWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET_PREVIOUS,
    };
    const setOrDelete = (name, value) => {
        if (value === undefined || value === null) delete process.env[name];
        else process.env[name] = value;
    };
    // Key and country are always managed so ambient credentials cannot leak
    // into tests that are meant to run without payment configuration.
    setOrDelete("PAYSTACK_SECRET_KEY", settings.key);
    setOrDelete("PAYSTACK_ACCOUNT_COUNTRY", settings.country);
    if (Object.hasOwn(settings, "nodeEnv")) setOrDelete("NODE_ENV", settings.nodeEnv);
    if (Object.hasOwn(settings, "webhookSecret")) setOrDelete("PAYSTACK_WEBHOOK_SECRET", settings.webhookSecret);
    if (Object.hasOwn(settings, "previousWebhookSecret")) setOrDelete("PAYSTACK_WEBHOOK_SECRET_PREVIOUS", settings.previousWebhookSecret);
    try {
        await callback();
    } finally {
        setOrDelete("PAYSTACK_SECRET_KEY", previous.key);
        setOrDelete("PAYSTACK_ACCOUNT_COUNTRY", previous.country);
        setOrDelete("NODE_ENV", previous.nodeEnv);
        setOrDelete("PAYSTACK_WEBHOOK_SECRET", previous.webhookSecret);
        setOrDelete("PAYSTACK_WEBHOOK_SECRET_PREVIOUS", previous.previousWebhookSecret);
    }
}

function responseStub(onSettled) {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; if (onSettled) onSettled(); return this; },
    };
}

// asyncHandler does not return its internal promise, so wait for the response
// or the error callback before making assertions.
async function invoke(controller, req) {
    let settle;
    const settled = new Promise((resolve) => { settle = resolve; });
    let error;
    const res = responseStub(() => settle());
    controller(req, res, (caught) => { error = caught; settle(); });
    await settled;
    return { res, error };
}

test("public donation currencies always include all nine definitions without payment credentials", async () => {
    await withPaystackEnvironment({}, async () => {
        const { res, error } = await invoke(getDonationCurrencies, {});
        assert.equal(error, undefined);
        assert.equal(res.statusCode, 200);
        const currencies = res.body.data.currencies;
        assert.deepEqual(currencies.map(({ code }) => code), ["NGN", "USD", "GBP", "EUR", "CAD", "AUD", "GHS", "KES", "ZAR"]);
        assert.ok(currencies.every(({ available, providers }) => !available && providers.length === 0));
        assert.ok(currencies.every(({ availability }) => availability === "unavailable"));
        assert.ok(currencies.every(({ supportedProviders, unavailableReason }) => Array.isArray(supportedProviders) && unavailableReason));
        assert.equal(res.body.data.defaultCurrency, "NGN");
        assert.equal(currencies.find(({ code }) => code === "GHS").symbol, "GH₵");
        assert.ok(currencies.every(({ symbol }) => symbol !== "#"));
    });
});

test("the registered currency route is public and current CORS config accepts the production origin", async (t) => {
    const app = express();
    app.use(corsMiddleware);
    app.use("/api/donations", donationRoutes);
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    await new Promise((resolve) => server.once("listening", resolve));
    const deploymentOrigin = "https://royal-higher-life-9ttr-git-main-oluwaseyifunmi52-projects.vercel.app";
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/donations/currencies`, {
        headers: { Origin: deploymentOrigin },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), deploymentOrigin);
    assert.equal((await response.json()).data.currencies.length, 9);
    await new Promise((resolve, reject) => {
        corsOptions.origin("https://royal-higher-life-ag25.vercel.app", (error, allowed) => {
            if (error) reject(error);
            else if (!allowed) reject(new Error("Production origin is not allowed by CORS."));
            else resolve();
        });
    });
});

test("Paystack credentials enable only the currency this backend actually processes", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG" }, async () => {
        const { res, error } = await invoke(getDonationCurrencies, {});
        assert.equal(error, undefined);
        const currencies = res.body.data.currencies;
        assert.deepEqual(currencies.filter(({ available }) => available).map(({ code }) => code), ["NGN"]);
        assert.equal(currencies.find(({ code }) => code === "NGN").availability, "available");
        assert.deepEqual(res.body.data.providers.map(({ id }) => id), ["paystack"]);
        assert.deepEqual(currencies.find(({ code }) => code === "NGN").supportedProviders, ["paystack"]);
        assert.equal(res.body.data.defaultCurrency, "NGN");
    });
});

test("placeholder Paystack values do not mark a currency as payable", async () => {
    await withPaystackEnvironment({ key: "replace-me-with-a-real-key", country: "NG" }, async () => {
        const { res, error } = await invoke(getDonationCurrencies, {});
        assert.equal(error, undefined);
        assert.ok(res.body.data.currencies.every(({ available }) => !available));
        assert.equal(res.body.data.defaultCurrency, "NGN");
    });
});

test("a Paystack key without a verified account country is not advertised", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY }, async () => {
        const { res, error } = await invoke(getDonationCurrencies, {});
        assert.equal(error, undefined);
        assert.ok(res.body.data.currencies.every(({ available }) => !available));
    });
});

test("Paystack keys must match the environment this backend is running in", async () => {
    await withPaystackEnvironment({ key: "sk_live_0123456789abcdef", country: "NG", nodeEnv: "development" }, async () => {
        assert.equal(hasConfiguredNgnPaymentProvider(), false);
    });
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG", nodeEnv: "production" }, async () => {
        assert.equal(hasConfiguredNgnPaymentProvider(), false);
    });
    await withPaystackEnvironment({ key: "sk_live_0123456789abcdef", country: "NG", nodeEnv: "production" }, async () => {
        assert.equal(hasConfiguredNgnPaymentProvider(), true);
    });
});

test("currency availability mirrors the provider eligibility used by initialization", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG" }, async () => {
        const { res, error } = await invoke(getDonationCurrencies, {});
        assert.equal(error, undefined);
        assert.equal(hasConfiguredNgnPaymentProvider(), true);
        assert.deepEqual(getConfiguredDonationProviderIds(), ["paystack"]);
        assert.equal(res.body.data.currencies.find(({ code }) => code === "NGN").available, true);
        assert.ok(res.body.data.currencies.filter(({ code }) => code !== "NGN").every(({ available }) => !available));
    });
    await withPaystackEnvironment({}, async () => {
        const { res, error } = await invoke(getDonationCurrencies, {});
        assert.equal(error, undefined);
        assert.equal(hasConfiguredNgnPaymentProvider(), false);
        assert.deepEqual(getConfiguredDonationProviderIds(), []);
        assert.ok(res.body.data.currencies.every(({ available }) => !available));
    });
});

test("donation creation rejects NGN before database writes without verified Paystack eligibility", async () => {
    await withPaystackEnvironment({}, async () => {
        const create = mock.method(Donation, "create", async () => { throw new Error("database should not be reached"); });
        try {
            const { error } = await invoke(createDonation, {
                body: { name: "Test Donor", email: "test@example.com", phone: "08000000000", amount: 100, currency: "NGN" },
            });
            assert.equal(error.statusCode, 503);
            assert.match(error.message, /temporarily unavailable/i);
            assert.equal(create.mock.callCount(), 0);
        } finally {
            create.mock.restore();
        }
    });
});

test("donation creation rejects unsupported currencies even when NGN Paystack is configured", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG" }, async () => {
        const create = mock.method(Donation, "create", async () => { throw new Error("database should not be reached"); });
        try {
            const { error } = await invoke(createDonation, {
                body: { name: "Test Donor", email: "test@example.com", phone: "08000000000", amount: 100, currency: "USD" },
            });
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /not available for this currency yet/i);
            assert.equal(create.mock.callCount(), 0);
        } finally {
            create.mock.restore();
        }
    });
});

test("configured NGN donation initializes through the mocked Paystack adapter", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG" }, async () => {
        const fakeDonation = {
            _id: new mongoose.Types.ObjectId(),
            donorName: "Test Donor",
            email: "test@example.com",
            phone: "08000000000",
            amount: 12500,
            currency: "NGN",
            paymentMethod: "paystack",
            paymentReference: "RHLM-mock-reference",
            status: "pending",
            donationType: "General Offering",
            isAnonymous: true,
            note: "",
            campaign: null,
            createdAt: new Date(),
            verifiedAt: null,
        };
        let initializeOptions;
        const create = mock.method(Donation, "create", async () => fakeDonation);
        const updateOne = mock.method(Donation, "updateOne", async () => ({ acknowledged: true }));
        const audit = mock.method(DonationAudit, "create", async () => ({}));
        const initialize = mock.method(paymentService, "initializePayment", async (options) => {
            initializeOptions = options;
            return { status: true, data: { authorization_url: "https://checkout.example.test/mock-session" } };
        });
        try {
            const { res, error } = await invoke(createDonation, {
                body: { name: "Test Donor", email: "test@example.com", phone: "08000000000", amount: 12500, currency: "NGN", paymentMethod: "paypal", anonymous: true },
            });
            assert.equal(error, undefined, error && error.message);
            assert.equal(initialize.mock.callCount(), 1);
            assert.equal(res.statusCode, 201);
            assert.equal(initializeOptions.amount, 1250000);
            assert.equal(initializeOptions.currency, "NGN");
            assert.match(initializeOptions.reference, /^RHLM-\d+-[a-f\d]{20}$/);
            assert.equal(initializeOptions.metadata.donationId, String(fakeDonation._id));
            assert.equal(initializeOptions.metadata.isAnonymous, true);
            assert.equal(create.mock.calls[0].arguments[0].paymentMethod, "paystack");
            assert.equal(create.mock.calls[0].arguments[0].isAnonymous, true);
            assert.equal(res.body.data.authorizationUrl, "https://checkout.example.test/mock-session");
            assert.equal(updateOne.mock.callCount(), 0);
            assert.equal(audit.mock.callCount(), 1);
        } finally {
            create.mock.restore();
            updateOne.mock.restore();
            audit.mock.restore();
            initialize.mock.restore();
        }
    });
});

test("Paystack webhook rejects tampered events before any audit lookup", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG" }, async () => {
        const payload = { event: "charge.success", data: { id: "evt_tampered", reference: "RHLM-tampered" } };
        const signedBody = Buffer.from(JSON.stringify(payload));
        const signature = crypto.createHmac("sha512", VALID_TEST_KEY).update(signedBody).digest("hex");
        const rawBody = Buffer.from(JSON.stringify({ ...payload, amount: 999999 }));
        const exists = mock.method(DonationAudit, "exists", async () => { throw new Error("audit should not be reached"); });
        try {
            const { res, error } = await invoke(paystackWebhook, {
                rawBody, body: payload, headers: { "x-paystack-signature": signature },
            });
            assert.equal(error, undefined);
            assert.equal(res.statusCode, 401);
            assert.equal(exists.mock.callCount(), 0);
        } finally {
            exists.mock.restore();
        }
    });
});

test("duplicate Paystack webhook events are acknowledged without re-verification", async () => {
    await withPaystackEnvironment({ key: VALID_TEST_KEY, country: "NG" }, async () => {
        const payload = { event: "charge.success", data: { id: "evt_duplicate", reference: "RHLM-duplicate" } };
        const rawBody = Buffer.from(JSON.stringify(payload));
        const signature = crypto.createHmac("sha512", VALID_TEST_KEY).update(rawBody).digest("hex");
        const exists = mock.method(DonationAudit, "exists", async () => ({ _id: new mongoose.Types.ObjectId() }));
        const findOne = mock.method(Donation, "findOne", async () => { throw new Error("duplicate should not look up donation"); });
        const verify = mock.method(paymentService, "verifyPayment", async () => { throw new Error("duplicate should not call Paystack"); });
        try {
            const { res, error } = await invoke(paystackWebhook, {
                rawBody, body: payload, headers: { "x-paystack-signature": signature },
            });
            assert.equal(error, undefined);
            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body, { received: true });
            assert.equal(exists.mock.callCount(), 1);
            assert.deepEqual(exists.mock.calls[0].arguments[0], { eventId: "evt_duplicate" });
            assert.equal(findOne.mock.callCount(), 0);
            assert.equal(verify.mock.callCount(), 0);
        } finally {
            exists.mock.restore();
            findOne.mock.restore();
            verify.mock.restore();
        }
    });
});
