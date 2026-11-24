const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { once } = require("node:events");
const { ipKeyGenerator } = require("express-rate-limit");
const {
    authLimiter,
    publicSubmissionLimiter,
    webhookLimiter,
    passwordResetLimiter,
    createRateLimiter,
    createPublicSubmissionLimiter,
    registrationLimiter,
    loginLimiter,
    verificationLimiter,
    resendOtpLimiter,
    passwordResetRequestLimiter,
    passwordResetSubmitLimiter,
} = require("../Middleware/rateLimiter");
const { connectDB, describeMongoUri, describeConnectionError, parseDnsServers } = require("../Config/db");

test("the rate limiters initialize and IPv6 addresses use subnet keys", () => {
    assert.equal(typeof authLimiter, "function");
    assert.equal(typeof publicSubmissionLimiter, "function");
    assert.equal(typeof webhookLimiter, "function");
    assert.equal(typeof passwordResetLimiter, "function");
    assert.equal(ipKeyGenerator("2001:db8:abcd:12::1"), "2001:db8:abcd::/56");
    assert.equal(ipKeyGenerator("192.0.2.18"), "192.0.2.18");
});

test("custom rate limiter processes an IPv6 client request", async () => {
    const app = express();
    app.set("trust proxy", "loopback");
    app.get("/", createRateLimiter({ max: 5 }), (_req, res) => res.sendStatus(200));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
        const address = server.address();
        const response = await fetch(`http://127.0.0.1:${address.port}/`, {
            headers: { "X-Forwarded-For": "2001:db8:abcd:12::1" },
        });
        assert.equal(response.status, 200);
    } finally {
        server.close();
        await once(server, "close");
    }
});

test("public form limiters use independent counters and leave read/admin routes outside the quota", async () => {
    const app = express();
    app.set("trust proxy", "loopback");
    const contactsLimiter = createPublicSubmissionLimiter({ max: 2 });
    const donationsLimiter = createPublicSubmissionLimiter({ max: 2 });
    app.post("/api/contacts", contactsLimiter, (_req, res) => res.sendStatus(201));
    app.post("/api/donations", donationsLimiter, (_req, res) => res.sendStatus(201));
    app.get("/api/contacts", (_req, res) => res.sendStatus(200));
    app.post("/api/contacts/:id/retry-notification", (_req, res) => res.sendStatus(200));

    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const send = (path, method = "POST") => fetch(`${baseUrl}${path}`, {
            method,
            headers: { "X-Forwarded-For": "192.0.2.20" },
        });

        assert.equal((await send("/api/contacts")).status, 201);
        assert.equal((await send("/api/contacts")).status, 201);
        assert.equal((await send("/api/donations")).status, 201);
        assert.equal((await send("/api/donations")).status, 201);
        assert.equal((await send("/api/contacts")).status, 429);
        assert.equal((await send("/api/donations")).status, 429);
        assert.equal((await send("/api/contacts", "GET")).status, 200);
        assert.equal((await send("/api/contacts/record/retry-notification")).status, 200);
    } finally {
        server.close();
        await once(server, "close");
    }
});

test("authentication flow limits are independent while backward-compatible aliases share them", () => {
    assert.equal(typeof registrationLimiter, "function");
    assert.equal(typeof loginLimiter, "function");
    assert.equal(typeof verificationLimiter, "function");
    assert.equal(typeof resendOtpLimiter, "function");
    assert.equal(typeof passwordResetRequestLimiter, "function");
    assert.equal(typeof passwordResetSubmitLimiter, "function");
    assert.notEqual(registrationLimiter, loginLimiter);
    assert.notEqual(verificationLimiter, resendOtpLimiter);
    assert.notEqual(passwordResetRequestLimiter, passwordResetSubmitLimiter);
});

test("database target reporting distinguishes Atlas SRV and explicit local URIs", () => {
    assert.deepEqual(
        describeMongoUri("mongodb+srv://user:secret@cluster.example.net/royal"),
        { host: "cluster.example.net", kind: "MongoDB Atlas SRV" }
    );
    assert.deepEqual(
        describeMongoUri("mongodb://127.0.0.1:27017/royal-backend"),
        { host: "127.0.0.1", kind: "local MongoDB" }
    );
});

test("DNS resolver failures are classified separately from MongoDB TCP refusals", () => {
    const dnsError = Object.assign(new Error("querySrv ECONNREFUSED _mongodb._tcp.cluster.example.net"), {
        code: "ECONNREFUSED",
        syscall: "querySrv",
        hostname: "_mongodb._tcp.cluster.example.net",
    });
    const described = describeConnectionError(dnsError);
    assert.equal(described.phase, "dns");
    assert.equal(described.code, "ECONNREFUSED");
    assert.match(described.message, /local DNS resolver problem/);
    assert.doesNotMatch(described.message, /host refused the connection/);

    const tcpError = Object.assign(new Error("connect ECONNREFUSED 192.0.2.10:27017"), {
        code: "ECONNREFUSED",
        syscall: "connect",
    });
    const tcp = describeConnectionError(tcpError);
    assert.equal(tcp.phase, "connection");
    assert.match(tcp.message, /host refused the connection/);
});

test("NODE_DNS_SERVERS accepts IP lists and rejects non-IP values", () => {
    assert.deepEqual(parseDnsServers("8.8.8.8, 1.1.1.1"), ["8.8.8.8", "1.1.1.1"]);
    assert.deepEqual(parseDnsServers(""), []);
    assert.deepEqual(parseDnsServers(undefined), []);
    assert.throws(() => parseDnsServers("dns.google"), /comma-separated list of IP addresses/);
    assert.throws(() => parseDnsServers("8.8.8.8:53"), /comma-separated list of IP addresses/);
});

test("invalid NODE_DNS_SERVERS aborts before opening a MongoDB connection", async () => {
    const originalUri = process.env.MONGO_URI;
    const originalDns = process.env.NODE_DNS_SERVERS;
    process.env.MONGO_URI = "mongodb+srv://user:placeholder@cluster.example.net/royal";
    process.env.NODE_DNS_SERVERS = "not-an-ip";
    try {
        await assert.rejects(connectDB(), /NODE_DNS_SERVERS/);
    } finally {
        if (originalUri === undefined) delete process.env.MONGO_URI;
        else process.env.MONGO_URI = originalUri;
        if (originalDns === undefined) delete process.env.NODE_DNS_SERVERS;
        else process.env.NODE_DNS_SERVERS = originalDns;
    }
});

test("missing MONGO_URI fails clearly without trying a local fallback", async () => {
    const originalUri = process.env.MONGO_URI;
    const originalFallback = process.env.MONGO_URI_2;
    delete process.env.MONGO_URI;
    process.env.MONGO_URI_2 = "mongodb://127.0.0.1:27017/should-not-be-used";
    try {
        await assert.rejects(connectDB(), /Missing required environment variable MONGO_URI/);
    } finally {
        if (originalUri === undefined) delete process.env.MONGO_URI;
        else process.env.MONGO_URI = originalUri;
        if (originalFallback === undefined) delete process.env.MONGO_URI_2;
        else process.env.MONGO_URI_2 = originalFallback;
    }
});
