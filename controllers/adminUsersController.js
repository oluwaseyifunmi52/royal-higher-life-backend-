const bcrypt = require("bcryptjs");
const User = require("../Models/user");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const mailer = require("../utils/mailer");
const { recordAdminAction } = require("../services/adminAuditService");
const crypto = require("crypto");

const ADMIN_ROLES = ["superAdmin", "contentAdmin", "mediaAdmin", "ministryAdmin"];
const ASSIGNABLE_ADMIN_ROLES = ["superAdmin", "contentAdmin", "mediaAdmin"];
const adminFilter = { role: { $in: ["admin", ...ADMIN_ROLES] } };
const roleLabel = (role) => ({ superAdmin: "Super Admin", contentAdmin: "Content Admin", mediaAdmin: "Media Admin", ministryAdmin: "Ministry Admin" }[role] || role);
const isStrongAdminPassword = (password) => typeof password === "string" && password.length >= 12 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

const listAdminUsers = asyncHandler(async (req, res) => {
    const query = String(req.query.search || "").trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = query ? { $and: [adminFilter, { $or: [
        { firstName: { $regex: query, $options: "i" } }, { lastName: { $regex: query, $options: "i" } }, { email: { $regex: query, $options: "i" } },
    ] }] } : adminFilter;
    const users = await User.find(filter).select("firstName lastName email phone role isActive isEmailVerified createdAt lastLoginAt").sort({ createdAt: -1 }).lean();
    return res.status(200).json(new ApiResponse(200, "Administrator accounts fetched", users));
});

const createAdminUser = asyncHandler(async (req, res) => {
    const { fullName, email, password, confirmPassword, role } = req.body;
    const normalizedName = typeof fullName === "string" ? fullName.trim().replace(/\s+/g, " ") : "";
    const nameParts = normalizedName.split(" ");
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (normalizedName.length < 3 || normalizedName.length > 200 || nameParts.length < 2 ||
        !/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254 ||
        !ASSIGNABLE_ADMIN_ROLES.includes(role)) {
        throw new ApiError(400, "Enter a full name, valid email address and supported administrator role.");
    }
    if (!isStrongAdminPassword(password)) throw new ApiError(400, "Choose a 12–128 character password with lowercase, uppercase, a number and a symbol.");
    if (password !== confirmPassword) throw new ApiError(400, "Passwords do not match.");
    if (await User.exists({ email: normalizedEmail })) throw new ApiError(409, "An account already uses that email address.");

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    let user;
    try {
        user = await User.create({
            firstName: nameParts[0], lastName: nameParts.slice(1).join(" "), email: normalizedEmail,
            password: passwordHash, provider: "local", role, isEmailVerified: false, isActive: false,
            otp: crypto.createHash("sha256").update(verificationToken).digest("hex"),
            otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        });
    } catch (error) {
        if (error?.code === 11000) throw new ApiError(409, "An account already uses these details.");
        throw error;
    }
    let verificationEmailSent = false;
    try { verificationEmailSent = Boolean((await mailer.sendVerificationEmail(user, verificationToken))?.sent); }
    catch (error) {
        console.error("Administrator verification email could not be sent.", { reason: error?.name || "unknown_error", userId: String(user._id) });
    }
    await recordAdminAction(req.user, "administrator.create", "user", user._id, { role, verificationEmailSent });
    return res.status(201).json(new ApiResponse(201, verificationEmailSent
        ? "Administrator account created. Verify the email address before signing in."
        : "Administrator account created, but verification email delivery failed. Request a new verification link before signing in.", {
        id: user._id, fullName: normalizedName, email: user.email, role: user.role, isActive: user.isActive, verificationEmailSent,
    }));
});

const updateAdminDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    const normalizedName = typeof fullName === "string" ? fullName.trim().replace(/\s+/g, " ") : "";
    const nameParts = normalizedName.split(" ");
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (normalizedName.length < 3 || normalizedName.length > 200 || nameParts.length < 2 ||
        !/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
        throw new ApiError(400, "Enter a full name and valid email address.");
    }
    const user = await User.findOne({ _id: req.params.id, ...adminFilter }).select("+otp +otpExpires");
    if (!user) throw new ApiError(404, "Administrator account not found.");
    const emailChanged = user.email !== normalizedEmail;
    if (emailChanged && await User.exists({ email: normalizedEmail, _id: { $ne: user._id } })) throw new ApiError(409, "An account already uses that email address.");
    user.firstName = nameParts[0];
    user.lastName = nameParts.slice(1).join(" ");
    user.email = normalizedEmail;
    let verificationEmailSent;
    if (emailChanged) {
        const token = crypto.randomBytes(32).toString("hex");
        user.otp = crypto.createHash("sha256").update(token).digest("hex");
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.isEmailVerified = false;
        user.isActive = false;
        try { await user.save(); }
        catch (error) { if (error?.code === 11000) throw new ApiError(409, "An account already uses that email address."); throw error; }
        try { verificationEmailSent = Boolean((await mailer.sendVerificationEmail(user, token))?.sent); }
        catch { verificationEmailSent = false; }
    } else {
        try { await user.save(); }
        catch (error) { if (error?.code === 11000) throw new ApiError(409, "An account already uses that email address."); throw error; }
    }
    await recordAdminAction(req.user, "administrator.details-update", "user", user._id, { fields: emailChanged ? ["name", "email"] : ["name"], ...(emailChanged ? { verificationEmailSent } : {}) });
    return res.status(200).json(new ApiResponse(200, emailChanged
        ? verificationEmailSent ? "Administrator details updated. Verify the new email address before signing in." : "Administrator details updated, but the verification email could not be sent. Request a new verification link."
        : "Administrator details updated.", { id: user._id, fullName: normalizedName, email: user.email, role: user.role, isActive: user.isActive, ...(emailChanged ? { verificationEmailSent } : {}) }));
});

const updateAdminUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!ASSIGNABLE_ADMIN_ROLES.includes(role)) throw new ApiError(400, "Choose a supported administrator role.");
    if (String(req.user._id) === req.params.id) throw new ApiError(409, "You cannot change your own administrator role.");
    const existing = await User.findOne({ _id: req.params.id, ...adminFilter });
    if (!existing) throw new ApiError(404, "Administrator account not found.");
    if (existing.role === "superAdmin" && existing.isActive && (role !== "superAdmin" || !existing.isActive) && await User.countDocuments({ role: "superAdmin", isActive: true }) < 2) throw new ApiError(409, "The last active Super Admin cannot be demoted.");
    existing.role = role;
    existing.tokenVersion = (existing.tokenVersion || 0) + 1;
    await existing.save();
    await recordAdminAction(req.user, "administrator.role-update", "user", existing._id, { role });
    return res.status(200).json(new ApiResponse(200, "Administrator role updated", { id: existing._id, firstName: existing.firstName, lastName: existing.lastName, email: existing.email, role: existing.role, isActive: existing.isActive }));
});

const setAdminStatus = asyncHandler(async (req, res) => {
    const active = req.params.action === "reactivate";
    if (!active && req.params.action !== "suspend") throw new ApiError(400, "Unsupported account action.");
    if (String(req.user._id) === req.params.id) throw new ApiError(409, "You cannot suspend or revoke your own account.");
    const user = await User.findOne({ _id: req.params.id, ...adminFilter });
    if (!user) throw new ApiError(404, "Administrator account not found.");
    if (!active && user.role === "superAdmin" && user.isActive && await User.countDocuments({ role: "superAdmin", isActive: true }) < 2) throw new ApiError(409, "The last active Super Admin cannot be suspended.");
    user.isActive = active;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await recordAdminAction(req.user, active ? "administrator.reactivate" : "administrator.suspend", "user", user._id, { role: user.role });
    if (!active && user.isEmailVerified) await mailer.sendAdminSuspensionNotice(user).catch(() => ({ sent: false }));
    return res.status(200).json(new ApiResponse(200, active ? "Administrator reactivated" : "Administrator suspended", { id: user._id, isActive: user.isActive }));
});

const revokeAdminAccess = asyncHandler(async (req, res) => {
    if (String(req.user._id) === req.params.id) throw new ApiError(409, "You cannot revoke your own administrator access.");
    const user = await User.findOne({ _id: req.params.id, ...adminFilter }).select("+password");
    if (!user) throw new ApiError(404, "Administrator account not found.");
    if (user.role === "superAdmin" && user.isActive && await User.countDocuments({ role: "superAdmin", isActive: true }) < 2) throw new ApiError(409, "The last active Super Admin cannot lose administrator access.");
    user.role = "member";
    // Active local members still require a phone number. An administrator
    // created without one remains inactive if later changed into a member.
    user.isActive = Boolean(user.phone && user.password);
    // The hash (never the raw token) is retained so a revoked link reports
    // "revoked" distinctly; the role change and marker block any acceptance.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await recordAdminAction(req.user, "administrator.revoke", "user", user._id, {});
    return res.status(200).json(new ApiResponse(200, "Administrator access revoked", { id: user._id, role: user.role }));
});

module.exports = { listAdminUsers, createAdminUser, updateAdminDetails, updateAdminUserRole, setAdminStatus, revokeAdminAccess, isStrongAdminPassword };
