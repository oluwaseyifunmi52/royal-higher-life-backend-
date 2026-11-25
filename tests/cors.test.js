const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { corsMiddleware, corsOptions, allowedOrigins } = require("../Config/cors");
const errorHandler = require("../Middleware/errorHandler");

const deploymentOrigin = "https://royal-higher-life-9ttr-git-main-oluwaseyifunmi52-projects.vercel.app";
const existingProductionOrigins = [
    "https://royal-higher-life-ag25.vercel.app",
    "https://royal-higher-life-9ttr.vercel.app",
    "https://royal-higher-life-v9tt.vercel.app",
];

function checkOrigin(config, origin) {
    return new Promise((resolve) => {
        config.corsOptions.origin(origin, (error, allowed) => resolve({ error, allowed }));
    });
}

function loadCorsConfig(env) {
    const modulePath = require.resolve("../Config/cors");
    const previous = {
        nodeEnv: process.env.NODE_ENV,
        corsOrigin: process.env.CORS_ORIGIN,
    };
    delete require.cache[modulePath];
    if (Object.hasOwn(env, "nodeEnv")) process.env.NODE_ENV = env.nodeEnv;
    else delete process.env.NODE_ENV;
    if (Object.hasOwn(env, "corsOrigin")) process.env.CORS_ORIGIN = env.corsOrigin;
    else delete process.env.CORS_ORIGIN;
    try {
        return require(modulePath);
    } finally {
        delete require.cache[modulePath];
        if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous.nodeEnv;
        if (previous.corsOrigin === undefined) delete process.env.CORS_ORIGIN;
        else process.env.CORS_ORIGIN = previous.corsOrigin;
    }
}

async function withServer(app, callback) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
        return await callback(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

test("the confirmed deployment and all existing production origins remain allowed", async () => {
    assert.ok(allowedOrigins.includes(deploymentOrigin));
    for (const origin of [...existingProductionOrigins, deploymentOrigin]) {
        const result = await checkOrigin({ corsOptions }, origin);
        assert.equal(result.error, null, `${origin} should not be rejected`);
        assert.equal(result.allowed, true, `${origin} should be allowed`);
    }
});

test("CORS_ORIGIN entries are appended and local origins are limited to non-production", async () => {
    const configuredOrigin = "https://additional-approved.example.org";
    const production = loadCorsConfig({ nodeEnv: "production", corsOrigin: configuredOrigin });
    assert.ok(production.allowedOrigins.includes(configuredOrigin));
    assert.ok(!production.allowedOrigins.includes("http://localhost:5173"));

    const development = loadCorsConfig({ nodeEnv: "development", corsOrigin: configuredOrigin });
    assert.ok(development.allowedOrigins.includes(configuredOrigin));
    assert.ok(development.allowedOrigins.includes("http://localhost:5173"));
    const localResult = await checkOrigin(development, "http://localhost:5173");
    assert.equal(localResult.error, null);
    assert.equal(localResult.allowed, true);
});

test("an unrelated origin receives a distinct 403 CORS rejection", async () => {
    const result = await checkOrigin({ corsOptions }, "https://unrelated.example.org");
    assert.equal(result.allowed, undefined);
    assert.equal(result.error?.code, "CORS_ORIGIN_DENIED");
    assert.equal(result.error?.statusCode, 403);
});

test("allowed POST preflight succeeds and requests without Origin still reach routes", async () => {
    const app = express();
    app.use(corsMiddleware);
    app.post("/api/prayers", (_req, res) => res.status(201).json({ success: true }));
    app.get("/api/donations/currencies", (_req, res) => res.status(200).json({ success: true }));
    app.use(errorHandler);

    await withServer(app, async (baseUrl) => {
        const preflight = await fetch(`${baseUrl}/api/prayers`, {
            method: "OPTIONS",
            headers: {
                Origin: deploymentOrigin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-origin"), deploymentOrigin);
        assert.ok(preflight.headers.get("access-control-allow-methods").includes("POST"));
        assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/i);
        assert.match(preflight.headers.get("access-control-allow-headers"), /Content-Type/i);
        assert.equal(preflight.headers.get("access-control-allow-credentials"), null);

        const noOrigin = await fetch(`${baseUrl}/api/donations/currencies`);
        assert.equal(noOrigin.status, 200);
        assert.deepEqual(await noOrigin.json(), { success: true });
    });
});

test("HTTP CORS rejection is handled as 403 without reaching the route", async () => {
    const app = express();
    app.use(corsMiddleware);
    app.get("/private-to-browser-origin", (_req, res) => res.json({ reached: true }));
    app.use(errorHandler);

    await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/private-to-browser-origin`, {
            headers: { Origin: "https://unrelated.example.org" },
        });
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), {
            success: false,
            message: "Origin is not allowed",
        });
        assert.equal(response.headers.get("access-control-allow-origin"), null);
    });
});
