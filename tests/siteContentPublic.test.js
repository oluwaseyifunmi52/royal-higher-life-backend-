const { test } = require("node:test");
const assert = require("node:assert/strict");
const SiteContent = require("../Models/siteContent");
const { getPublicSiteContent } = require("../controllers/siteContentController");

const originalFindOne = SiteContent.findOne;
const call = (handler) => new Promise((resolve, reject) => handler({}, {
    status(code) { this.code = code; return this; },
    json(body) { resolve({ code: this.code, body }); },
}, reject));

test("public site content only returns the published CMS version", async (t) => {
    t.after(() => { SiteContent.findOne = originalFindOne; });
    let filter;
    SiteContent.findOne = (query) => {
        filter = query;
        return { select: async (fields) => {
            assert.equal(fields, "publishedContent updatedAt");
            return { publishedContent: {}, content: { heroHeading: "DRAFT ONLY" } };
        } };
    };
    const response = await call(getPublicSiteContent);
    assert.deepEqual(filter, { key: "primary", isPublished: true });
    assert.equal(response.code, 200);
    assert.deepEqual(response.body.data, {});
    assert.equal(JSON.stringify(response.body).includes("DRAFT ONLY"), false);

    SiteContent.findOne = () => ({ select: async () => null });
    const emptyResponse = await call(getPublicSiteContent);
    assert.equal(emptyResponse.code, 200);
    assert.deepEqual(emptyResponse.body.data, {});
});
