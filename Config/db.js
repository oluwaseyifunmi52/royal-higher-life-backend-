// Apply the DNS resolver override BEFORE mongoose (and the bundled MongoDB
// driver) are loaded: mongodb+srv lookups go through Node's c-ares resolver,
// which defaults to a dead 127.0.0.1 stub on this machine (ECONNREFUSED/querySrv).
const { applyDnsOverride, parseDnsServers } = require("./dns");
applyDnsOverride();

const dns = require("dns");
const mongoose = require("mongoose");

const DNS_QUERY_SYSCALLS = new Set(["querySrv", "queryTxt", "queryA", "queryAaaa"]);

function describeMongoUri(uri) {
    try {
        const parsed = new URL(uri);
        const isSrv = parsed.protocol === "mongodb+srv:";
        const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
        return {
            host: parsed.hostname,
            kind: isSrv ? "MongoDB Atlas SRV" : isLoopback ? "local MongoDB" : "configured MongoDB",
        };
    } catch {
        return { host: "unknown host", kind: "configured MongoDB" };
    }
}

function getErrorCode(error) {
    if (error?.code) return error.code;
    if (error?.cause?.code) return error.cause.code;
    const servers = error?.reason?.servers;
    if (servers && typeof servers.values === "function") {
        for (const server of servers.values()) {
            if (server.error?.code) return server.error.code;
        }
    }
    return error?.name || "MongoConnectionError";
}

function getErrorSyscall(error) {
    return error?.syscall || error?.cause?.syscall || null;
}

function isDnsError(error) {
    if (DNS_QUERY_SYSCALLS.has(getErrorSyscall(error))) return true;
    return /^query(Srv|Txt|A|Aaaa)\b/.test(error?.message || "");
}

// parseDnsServers and applyDnsOverride now live in ./dns so the resolver is
// configured in exactly one place, before the MongoDB driver loads.

function describeConnectionError(error) {
    const code = getErrorCode(error);
    const syscall = getErrorSyscall(error);
    const hostname = error?.hostname || error?.cause?.hostname || null;
    const resolver = dns.getServers();

    if (isDnsError(error)) {
        const resolverList = resolver.length > 0 ? resolver.join(", ") : "none";
        return {
            phase: "dns",
            code,
            syscall,
            hostname,
            resolver,
            message: `DNS resolution failed for the MongoDB Atlas SRV/TXT records (code: ${code}, query: ${syscall || "dns"}). Node's resolver is using: ${resolverList}. This is a local DNS resolver problem, not an Atlas network-access rejection. Fix the machine's DNS settings or set NODE_DNS_SERVERS.`,
        };
    }

    const detail = code === "ENOTFOUND"
        ? "DNS could not resolve the configured MongoDB host."
        : code === "ECONNREFUSED"
            ? "The configured MongoDB host refused the connection."
            : "Check the MongoDB URI, cluster status, network access list, and DNS configuration.";

    return { phase: "connection", code, syscall, hostname, resolver, message: detail };
}

async function connectDB(options = {}) {
    const mongoUri = process.env.MONGO_URI?.trim();
    if (!mongoUri) {
        throw new Error("Missing required environment variable MONGO_URI. No local database fallback is configured.");
    }

    const target = describeMongoUri(mongoUri);
    applyDnsOverride();

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
            autoIndex: options.autoIndex ?? process.env.NODE_ENV === "development",
        });

        console.info("MongoDB connection established.", {
            target: target.kind,
            database: mongoose.connection.name,
            host: mongoose.connection.host,
        });
        return mongoose.connection;
    } catch (error) {
        const described = describeConnectionError(error);
        console.error("MongoDB connection failed.", {
            target: target.kind,
            host: target.host,
            code: described.code,
            phase: described.phase,
            ...(described.phase === "dns" ? { query: described.syscall, resolver: described.resolver } : {}),
        });

        const startupError = new Error(`${described.message} Target: ${target.kind} at ${target.host} (code: ${described.code}).`);
        startupError.code = described.code;
        startupError.phase = described.phase;
        throw startupError;
    }
}

module.exports = { connectDB, describeMongoUri, describeConnectionError, parseDnsServers, applyDnsOverride };
