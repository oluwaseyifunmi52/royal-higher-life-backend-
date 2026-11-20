const AdminAudit = require("../Models/adminAudit");

async function recordAdminAction(actor, action, resource, resourceId, changes = {}) {
    try { await AdminAudit.create({ actor: actor?._id, action, resource, resourceId: String(resourceId || ""), changes }); }
    catch (error) { console.error("Admin audit write failed", { action, resource, code: error.code || "database_error" }); }
}

module.exports = { recordAdminAction };
