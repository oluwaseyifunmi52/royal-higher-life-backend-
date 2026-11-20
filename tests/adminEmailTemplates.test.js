const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildEmail } = require("../utils/emailTemplates");

test("administrator suspension message uses the branded template", () => {
    assert.match(buildEmail("adminSuspended", { name: "Ada" }).text, /access was suspended/i);
});
