const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "unit-test-secret-not-for-production";
const { filterProfileUpdates } = require("../services/authService");
const { filterAdminUserUpdates } = require("../controllers/userController");

test("profile updates allow ordinary fields but reject role and credential fields", () => {
    assert.deepEqual(
        filterProfileUpdates({
            firstName: "Member",
            country: "Nigeria",
            role: "admin",
            isEmailVerified: true,
            password: "attacker-controlled",
            resetPasswordToken: "token",
            $set: { role: "admin" },
        }),
        { firstName: "Member", country: "Nigeria" }
    );
});

test("profile pictures accept only HTTPS Cloudinary URLs", () => {
    assert.deepEqual(filterProfileUpdates({ profileImage: "javascript:alert(1)" }), {});
    assert.deepEqual(
        filterProfileUpdates({ profileImage: "https://res.cloudinary.com/example/image/upload/member.png" }),
        { profileImage: "https://res.cloudinary.com/example/image/upload/member.png" }
    );
});

test("admin user edits cannot mass-assign credentials or internal account state", () => {
    assert.deepEqual(
        filterAdminUserUpdates({
            firstName: "  Member  ",
            email: " MEMBER@EXAMPLE.COM ",
            role: "member",
            isActive: false,
            isEmailVerified: true,
            password: "unhashed-password",
            resetPasswordToken: "secret",
            profileImage: "javascript:alert(1)",
            $set: { role: "admin" },
        }),
        { firstName: "Member", email: "member@example.com", role: "member", isActive: false }
    );
});
