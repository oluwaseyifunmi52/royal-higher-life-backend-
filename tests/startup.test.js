const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { once } = require("node:events");
const { ipKeyGenerator } = require("express-rate-limit");
const { authLimiter, publicSubmissionLimiter, passwordResetLimiter, createRateLimiter } = require("../Middleware/rateLimiter");
const { connectDB, describeMongoUri, describeConnectionError, parseDnsServers } = require("../Config/db");

test("the three rate limiters initialize and IPv6 addresses use subnet keys", () => {
    assert.equal(typeof authLimiter, "function");
    assert.equal(typeof publicSubmissionLimiter, "function");
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
