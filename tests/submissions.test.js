const { test } = require("node:test");
const assert = require("node:assert/strict");
const Review = require("../Models/review");
const PrayerRequest = require("../Models/prayerRequest");
const Contact = require("../Models/contact");
const { buildEmail } = require("../utils/emailTemplates");

test("testimony records default to private pending review with a unique reference", () => {
    const first = new Review({ name: "Test Person", message: "A sufficiently long testimony", rating: 5 });
    const second = new Review({ name: "Another Person", message: "Another sufficiently long testimony", rating: 4 });
    assert.match(first.reference, /^RHL-TST-[A-F0-9]{10}$/);
    assert.notEqual(first.reference, second.reference);
    assert.equal(first.status, "pending");
    assert.equal(first.isApproved, false);
    assert.equal(first.publicationConsent, false);
});

test("prayer and contact records get independent references and private workflow defaults", () => {
    const prayer = new PrayerRequest({ name: "Test Person", email: "test@example.com", request: "Please pray for my family" });
    const contact = new Contact({ name: "Test Person", email: "test@example.com", message: "A contact message" });
    assert.match(prayer.reference, /^RHL-PRY-[A-F0-9]{10}$/);
    assert.match(contact.reference, /^RHL-CON-[A-F0-9]{10}$/);
    assert.equal(prayer.isPrivate, true);
    assert.equal(prayer.status, "pending");
    assert.equal(contact.status, "unread");
    assert.equal(contact.notificationStatus, "pending");
    assert.equal(contact.notificationDeliveryStatus, "unknown");
    assert.equal(contact.notificationAttemptCount, 0);
    assert.equal(Contact.schema.path("submissionKey").options.unique, true);
    assert.equal(Contact.schema.path("submissionKey").options.sparse, true);
});

test("submission emails include references, escape untrusted text, and omit prayer contents", () => {
    const confirmation = buildEmail("contactConfirmation", { name: "<Visitor>", reference: "RHL-CON-123", submittedAt: "2026-11-16" });
    assert.match(confirmation.html, /RHL-CON-123/);
    assert.match(confirmation.html, /&lt;Visitor&gt;/);

    const prayerNotification = buildEmail("adminPrayer", {
        name: "Visitor",
        category: "Family",
        reference: "RHL-PRY-123",
        submittedAt: "2026-11-16",
        adminUrl: "https://example.org/admin",
        request: "private sensitive content",
    });
    assert.match(prayerNotification.html, /RHL-PRY-123/);
    assert.doesNotMatch(prayerNotification.html, /private sensitive content/);
    assert.match(prayerNotification.html, /secure admin dashboard/i);
});
