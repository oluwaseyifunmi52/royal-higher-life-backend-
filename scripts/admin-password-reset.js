require("dotenv").config();

// Match Config/db.js: apply the DNS override before loading Mongoose/driver modules.
require("../Config/dns").applyDnsOverride();

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { connectDB } = require("../Config/db");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../Models/user");

const DATABASE_NAME = "royal_higherlife";
const ADMIN_EMAIL = "superadmin@royalhigherlife.org";
const CONFIRMATION_PHRASE = `RESET ${ADMIN_EMAIL}`;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const isStrongPassword = (password) => typeof password === "string" && password.length >= 12 && password.length <= 128 &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

function readHidden(prompt) {
    return new Promise((resolve, reject) => {
        stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        let value = "";
        const cleanup = () => {
            stdin.setRawMode(false);
            stdin.off("data", onData);
        };
        const onData = (buffer) => {
            for (const character of buffer.toString()) {
                if (character === "\u0003") {
                    cleanup();
                    stdout.write("\n");
                    reject(new Error("Password reset cancelled."));
                    return;
                }
                if (character === "\r" || character === "\n") {
                    cleanup();
                    stdout.write("\n");
                    resolve(value);
                    return;
                }
                if (character === "\u0008" || character === "\u007f") value = value.slice(0, -1);
                else if (character >= " ") value += character;
            }
        };
        stdin.on("data", onData);
    });
}

async function main() {
    if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
        throw new Error("Run this command in an interactive terminal that supports hidden password input.");
    }
    if (!process.env.MONGO_URI) throw new Error("Configure MONGO_URI in the backend .env first.");

    await connectDB();
    try {
        const activeDatabase = mongoose.connection.db?.databaseName;
        if (activeDatabase !== DATABASE_NAME) {
            throw new Error(`Refusing to continue: active database is not ${DATABASE_NAME}.`);
        }
        console.log(`Connected to the required database: ${DATABASE_NAME}.`);

        const accounts = await User.find({ email: ADMIN_EMAIL }).select("+password").limit(2);
        if (accounts.length !== 1) throw new Error("Refusing to continue: the specified account was not found exactly once.");
        const account = accounts[0];
        if (account.role !== "superAdmin") throw new Error("Refusing to continue: the existing account is not a Super Admin.");
        if (account.isActive !== true) throw new Error("Refusing to continue: the existing Super Admin account is inactive or suspended.");

        const prompt = readline.createInterface({ input: stdin, output: stdout });
        const confirmationPhrase = (await prompt.question(`Type exactly: ${CONFIRMATION_PHRASE}\nConfirmation: `)).trim();
        prompt.close();
        if (confirmationPhrase !== CONFIRMATION_PHRASE) throw new Error("Confirmation did not match; no account was changed.");

        const password = await readHidden("New password (12+ chars, upper/lowercase, number and symbol; hidden): ");
        const passwordConfirmation = await readHidden("Confirm new password (hidden): ");
        if (!EMAIL_PATTERN.test(account.email) || !isStrongPassword(password)) {
            throw new Error("Password must be 12–128 characters and include lowercase, uppercase, a number and a symbol; no account was changed.");
        }
        if (password !== passwordConfirmation) throw new Error("Passwords do not match; no account was changed.");

        // Same bcryptjs implementation and cost as the existing reset/change-password flows.
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await User.updateOne(
            { _id: account._id, email: ADMIN_EMAIL, role: "superAdmin", isActive: true },
            {
                $set: {
                    password: passwordHash,
                    otp: null,
                    otpExpires: null,
                    otpAttempts: 0,
                    resetPasswordToken: null,
                    resetPasswordExpires: null,
                },
                $inc: { tokenVersion: 1 },
            },
            { runValidators: true }
        );
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
            throw new Error("The existing account did not update exactly once; verify its state before retrying.");
        }
        console.log("Super Admin password reset completed. Existing sessions and password-reset credentials were invalidated.");
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error.message || "Super Admin password reset failed.");
    process.exitCode = 1;
});
