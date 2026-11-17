const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createDonation, getDonationCurrencies } = require("../controllers/donationController");
const donationRoutes = require("../routes/donationRoute");
const { corsOptions } = require("../Config/cors");

async function withPaystackEnvironment({ key, country } = {}, callback) {
    const previous = {
        key: process.env.PAYSTACK_SECRET_KEY,
        country: process.env.PAYSTACK_ACCOUNT_COUNTRY,
    };
    if (key === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = key;
    if (country === undefined) delete process.env.PAYSTACK_ACCOUNT_COUNTRY;
    else process.env.PAYSTACK_ACCOUNT_COUNTRY = country;
    try {
        await callback();
    } finally {
        if (previous.key === undefined) delete process.env.PAYSTACK_SECRET_KEY;
        else process.env.PAYSTACK_SECRET_KEY = previous.key;
        if (previous.country === undefined) delete process.env.PAYSTACK_ACCOUNT_COUNTRY;
        else process.env.PAYSTACK_ACCOUNT_COUNTRY = previous.country;
    }
}

function responseStub() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test("public donation currencies always include all nine definitions without payment credentials", async () => {
    await withPaystackEnvironment({}, async () => {
        const res = responseStub();
        let error;
        await getDonationCurrencies({}, res, (caught) => { error = caught; });
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
    app.use("/api/donations", donationRoutes);
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/donations/currencies`);
    assert.equal(response.status, 200);
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
    await withPaystackEnvironment({ key: "sk_test_0123456789abcdef", country: "NG" }, async () => {
        const res = responseStub();
        await getDonationCurrencies({}, res, (error) => { throw error; });
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
        const res = responseStub();
        await getDonationCurrencies({}, res, (error) => { throw error; });
        assert.ok(res.body.data.currencies.every(({ available }) => !available));
        assert.equal(res.body.data.defaultCurrency, "NGN");
    });
});

test("a Paystack key without a verified account country is not advertised", async () => {
    await withPaystackEnvironment({ key: "sk_test_0123456789abcdef" }, async () => {
        const res = responseStub();
        await getDonationCurrencies({}, res, (error) => { throw error; });
        assert.ok(res.body.data.currencies.every(({ available }) => !available));
    });
});

test("donation creation rejects NGN before database writes without verified Paystack eligibility", async () => {
    await withPaystackEnvironment({}, async () => {
        let error;
        await createDonation(
            { body: { name: "Test Donor", email: "test@example.com", phone: "08000000000", amount: 100, currency: "NGN" } },
            {},
            (caught) => { error = caught; }
        );
        assert.equal(error.statusCode, 503);
        assert.match(error.message, /temporarily unavailable/i);
    });
});

test("donation creation rejects unsupported currencies even when NGN Paystack is configured", async () => {
    await withPaystackEnvironment({ key: "sk_test_0123456789abcdef", country: "NG" }, async () => {
        let error;
        await createDonation(
            { body: { name: "Test Donor", email: "test@example.com", phone: "08000000000", amount: 100, currency: "USD" } },
            {},
            (caught) => { error = caught; }
        );
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /not available for this currency yet/i);
    });
});
