// Single source of truth for the Node.js DNS resolver override.
//
// Node's c-ares resolver on this machine defaults to a dead 127.0.0.1 stub, so
// SRV/TXT queries fail with ECONNREFUSED/querySrv unless an explicit resolver is
// configured. The MongoDB driver resolves mongodb+srv records through this same
// c-ares path, which is why PowerShell (Windows DNS client) works while Node fails.
//
// This module must be loaded and applied BEFORE mongoose/the MongoDB driver are
// required. It never touches the MongoDB URI, database name, TLS or credentials.
const dns = require("dns");
const net = require("net");

const DEFAULT_DNS_SERVERS = "8.8.8.8,8.8.4.4";

function parseDnsServers(value) {
    if (value == null) return [];
    const servers = String(value)
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean);
    const invalid = servers.filter((server) => net.isIP(server) === 0);
    if (invalid.length > 0) {
        throw new Error("NODE_DNS_SERVERS must be a comma-separated list of IP addresses (for example 8.8.8.8,8.8.4.4).");
    }
    return servers;
}

let dnsOverrideLogged = false;

function applyDnsOverride() {
    // NODE_DNS_SERVERS from .env wins; otherwise fall back to the verified
    // public resolver pair (dns.setServers(['8.8.8.8','8.8.4.4'])).
    const servers = parseDnsServers(process.env.NODE_DNS_SERVERS ?? DEFAULT_DNS_SERVERS);
    if (servers.length === 0) return null;

    // Never apply the override twice: skip if the resolver is already set to
    // exactly this list (keeps startup logging and setServers to a single call).
    const current = dns.getServers();
    const alreadyApplied = current.length === servers.length && servers.every((server, index) => current[index] === server);
    if (alreadyApplied) return servers;

    dns.setServers(servers);
    if (!dnsOverrideLogged) {
        console.info("Node DNS resolver overridden for MongoDB lookup.", { servers });
        dnsOverrideLogged = true;
    }
    return servers;
}

module.exports = { applyDnsOverride, parseDnsServers, DEFAULT_DNS_SERVERS };
