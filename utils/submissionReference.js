const crypto = require("node:crypto");

const PREFIXES = {
    testimony: "RHL-TST",
    prayer: "RHL-PRY",
    contact: "RHL-CON",
    volunteer: "RHL-VOL",
    event: "RHL-EVT",
};

function createSubmissionReference(type) {
    const prefix = PREFIXES[type];
    if (!prefix) throw new TypeError("Unknown submission reference type");
    return `${prefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

module.exports = { createSubmissionReference };
