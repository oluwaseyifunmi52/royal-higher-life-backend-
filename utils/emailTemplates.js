const MINISTRY = "Royal Higher Life Ministries";
const CONTACT_EMAIL = "royalhigherlifeoutreach@gmail.com";
const CONTACT_PHONE = "+234 9157754411";
const WEBSITE = "https://royal-higher-life-ag25.vercel.app";

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
}

function layout(title, content) {
    const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#17213a">
      <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e4e8ef;border-radius:12px;overflow:hidden">
        <header style="background:#0d1426;padding:24px 30px;color:#fff;border-bottom:3px solid #f5b335"><img src="${WEBSITE}/royal-higherlife-logo.jpeg" width="42" height="42" alt="" style="vertical-align:middle;margin-right:12px;object-fit:contain"><strong style="font-family:Georgia,serif;font-size:21px;vertical-align:middle">${MINISTRY}</strong></header>
        <main style="padding:30px;line-height:1.65"><h1 style="font-family:Georgia,serif;color:#0d1426;font-size:24px">${title}</h1>${content}</main>
        <footer style="padding:20px 30px;background:#f7f8fa;color:#596276;font-size:13px">${MINISTRY} · <a href="${WEBSITE}" style="color:#8e5d00">Visit our website</a><br>${CONTACT_EMAIL} · ${CONTACT_PHONE}</footer>
      </div></body></html>`;
    const text = `${title}\n\n${content.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim()}\n\n${MINISTRY}\n${CONTACT_EMAIL} · ${CONTACT_PHONE}\n${WEBSITE}`;
    return { html, text };
}

function buildEmail(template, values = {}) {
    const name = escapeHtml(values.name || "friend");
    switch (template) {
        case "verification":
            return layout("Verify Your Royal HigherLife Account", `<p>Hello ${name},</p><p>Welcome to Royal HigherLife Christian Ministries.</p><p>Thank you for creating an account with us.</p><p>Please verify your email address by clicking the button below.</p><p style="margin:28px 0"><a href="${escapeHtml(values.url)}" style="display:inline-block;background:#f5b335;color:#0d1426;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:7px">Verify My Email</a></p><p>This link is secure and expires after the configured verification period.</p><p>If you did not create this account, you can safely ignore this email.</p>`);
        case "passwordReset":
            return layout("Reset your password", `<p>Hello ${name},</p><p>We received a request to reset your password. Your one-time code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0d1426;text-align:center">${escapeHtml(values.code)}</p><p>This code expires in 10 minutes. If you did not request a reset, ignore this email.</p>`);
        case "adminSuspended":
            return layout("Administrator access updated", `<p>Hello ${name},</p><p>Your Royal HigherLife administrator access was suspended. Contact a Super Admin if you believe this is an error.</p>`);
        case "securityNotice":
            return layout("Your password was changed", `<p>Hello ${name},</p><p>The password for your ${MINISTRY} account was changed. If you did not make this change, contact us immediately at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`);
        case "contactConfirmation":
            return layout("We received your message", `<p>Hello ${name},</p><p>Thank you for contacting us. Your message has been received and our ministry team will follow up.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p><p>God bless you.</p>`);
        case "prayerConfirmation":
            return layout("We received your prayer request", `<p>Hello ${name},</p><p>Thank you for trusting us with your prayer request. Our ministry team has received it and will handle it confidentially.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p><p>“The prayer of a righteous person is powerful and effective.” — James 5:16</p>`);
        case "testimonyConfirmation":
            return layout("We received your testimony", `<p>Hello ${name},</p><p>Thank you for sharing what God has done in your life. Your testimony is pending ministry review and will not be published unless it is approved and you gave publication consent.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p>`);
        case "adminContact":
            return layout("New contact message", `<p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p><p><strong>Name:</strong> ${escapeHtml(values.name)}</p><p><strong>Email:</strong> ${escapeHtml(values.email)}</p><p><strong>Phone:</strong> ${escapeHtml(values.phone || "Not provided")}</p><p><strong>Subject:</strong> ${escapeHtml(values.subject || "General Inquiry")}</p><p><strong>Message:</strong><br>${escapeHtml(values.message).replace(/\n/g, "<br>")}</p>`);
        case "adminPrayer":
            return layout("New prayer request", `<p>A new confidential prayer request was submitted. Review it in the secure ministry dashboard.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p><p><strong>Name:</strong> ${escapeHtml(values.name)}</p><p><strong>Category:</strong> ${escapeHtml(values.category || "General Prayer")}</p><p>The prayer text and contact details are omitted from this notification to protect confidentiality.</p><p><a href="${escapeHtml(values.adminUrl)}">Open the secure admin dashboard</a></p>`);
        case "adminVolunteer":
            return layout("New volunteer application", `<p>A new volunteer application was received.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p><p><strong>Name:</strong> ${escapeHtml(values.name)}</p><p><strong>Email:</strong> ${escapeHtml(values.email)}</p><p><strong>Phone:</strong> ${escapeHtml(values.phone || "Not provided")}</p><p><strong>Ministry:</strong> ${escapeHtml(values.ministry || "Not specified")}</p><p><strong>Skills:</strong> ${escapeHtml(values.skills || "Not specified")}</p><p><strong>Availability:</strong> ${escapeHtml(values.availability || "Not specified")}</p><p><strong>Message:</strong><br>${escapeHtml(values.message || "Not provided").replace(/\n/g, "<br>")}</p>`);
        case "volunteerConfirmation":
            return layout("We received your volunteer application", `<p>Hello ${name},</p><p>Thank you for your interest in serving with Royal HigherLife Christian Ministries. Our team has received your application and will be in touch.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p>`);
        case "adminEventRegistration":
            return layout("New event registration", `<p>A registration was received for <strong>${escapeHtml(values.eventTitle)}</strong>.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Name:</strong> ${escapeHtml(values.name)}</p><p><strong>Email:</strong> ${escapeHtml(values.email)}</p><p><strong>Phone:</strong> ${escapeHtml(values.phone || "Not provided")}</p><p><strong>Guests:</strong> ${escapeHtml(values.numberOfGuests)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p>`);
        case "adminTestimony":
            return layout("New testimony awaiting review", `<p>A testimony was submitted and is pending review.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p><strong>Submitted:</strong> ${escapeHtml(values.submittedAt)}</p><p><strong>Name:</strong> ${escapeHtml(values.name)}</p><p><strong>Rating:</strong> ${escapeHtml(values.rating)} / 5</p><p><strong>Publication consent:</strong> ${values.publicationConsent ? "Given" : "Not given"}</p><p>The testimony is not publicly visible unless approved and publication consent was given.</p><p><a href="${escapeHtml(values.adminUrl)}">Open the secure admin dashboard</a></p>`);
        case "donationConfirmation":
            return layout("Your donation is confirmed", `<p>Hello ${name},</p><p>Paystack confirmed your donation of <strong>${escapeHtml(values.currency)} ${escapeHtml(values.amount)}</strong>.</p><p><strong>Reference:</strong> ${escapeHtml(values.reference)}</p><p>Keep this reference and use the email address used at checkout to access your donation receipt.</p><p><a href="${escapeHtml(values.trackingUrl)}">View or print your receipt</a></p><p>Thank you for supporting the ministry.</p>`);
        case "donationTracking":
            return layout("Verify your donation lookup", `<p>Hello,</p><p>Your one-time verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0d1426">${escapeHtml(values.code)}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`);
        case "eventConfirmation":
            return layout("Your event registration is confirmed", `<p>Hello ${name},</p><p>You are registered for <strong>${escapeHtml(values.eventTitle)}</strong>. We look forward to seeing you.</p><p>If you need to cancel, use this private link within 30 days: <a href="${escapeHtml(values.cancelUrl)}">Cancel registration</a>. Do not share this link.</p>`);
        case "newsletterConfirmation":
            return layout("You are subscribed", `<p>Hello ${name},</p><p>You will receive ministry news and event updates.</p><p><a href="${escapeHtml(values.unsubscribeUrl)}">Unsubscribe from these emails</a>. This private link expires in seven days and works once.</p>`);
        default:
            throw new Error("Unknown email template");
    }
}

module.exports = { buildEmail, escapeHtml };
