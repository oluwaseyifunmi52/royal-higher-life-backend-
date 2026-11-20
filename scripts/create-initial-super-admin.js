require("dotenv").config();
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const { connectDB } = require("../Config/db");
const mongoose = require("mongoose");
const User = require("../Models/user");

const BOOTSTRAP_LOCK_ID = "initial-super-admin-created";
const BOOTSTRAP_COLLECTION = "admin_bootstrap";
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
            const input = buffer.toString();
            if (input === "\u0003") {
                cleanup();
                stdout.write("\n");
                const error = new Error("Setup cancelled.");
                error.code = "SETUP_CANCELLED";
                reject(error);
                return;
            }
            if (input === "\r" || input === "\n") {
                cleanup();
                stdout.write("\n");
                resolve(value);
                return;
            }
            if (input === "\u0008" || input === "\u007f") value = value.slice(0, -1);
            else if (input >= " ") value += input;
        };
        stdin.on("data", onData);
    });
}

function getSafeDatabaseTarget(uri) {
    const parsed = new URL(uri);
    const path = parsed.pathname.replace(/^\//, "");
    const databaseFromUri = path ? decodeURIComponent(path) : "(driver default)";
    return { label: `${parsed.protocol}//${parsed.host}/${databaseFromUri}`, databaseFromUri };
}

async function main() {
    if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
        throw new Error("Run this command in an interactive terminal that supports hidden password input.");
    }
    if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
        throw new Error("Configure MONGO_URI and JWT_SECRET in the backend environment first.");
    }

    let lockAcquired = false;
    let accountCreated = false;
    await connectDB();
    try {
        const database = mongoose.connection.db.databaseName;
        const target = getSafeDatabaseTarget(process.env.MONGO_URI);
        console.log(`MongoDB target: ${target.label}`);
        console.log(`Active database: ${database}`);

        if (await User.exists({ role: "superAdmin" })) {
            throw new Error("A Super Admin already exists. No account was created. Use /admin/forgot-password to recover that account instead of rerunning bootstrap.");
        }

        const locks = mongoose.connection.db.collection(BOOTSTRAP_COLLECTION);
        if (await locks.findOne({ _id: BOOTSTRAP_LOCK_ID })) {
            throw new Error("Initial Super Admin setup has already been used. No account was created; use account recovery.");
        }

        const input = readline.createInterface({ input: stdin, output: stdout });
        const confirmation = (await input.question(`Type the active database name to confirm (${database}): `)).trim();
        if (confirmation !== database) {
            input.close();
            throw new Error("Database confirmation did not match; no account was created.");
        }
        const fullName = (await input.question("Full name: ")).trim().replace(/\s+/g, " ");
        const email = (await input.question("Admin email address: ")).trim().toLowerCase();
        input.close();

        const password = await readHidden("Password (12+ chars, upper/lowercase, number and symbol; hidden): ");
        const passwordConfirmation = await readHidden("Confirm password (hidden): ");
        const nameParts = fullName.split(" ");
        if (fullName.length < 3 || fullName.length > 200 || nameParts.length < 2 ||
            !EMAIL_PATTERN.test(email) || email.length > 254 || !isStrongPassword(password)) {
            throw new Error("Enter a full name, valid email and a 12–128 character password containing lowercase, uppercase, a number and a symbol.");
        }
        if (password !== passwordConfirmation) throw new Error("The passwords do not match; no account was created.");
        if (await User.exists({ email })) throw new Error("That email already belongs to an account; no account was changed.");

        try {
            await locks.insertOne({ _id: BOOTSTRAP_LOCK_ID, createdAt: new Date() });
            lockAcquired = true;
        } catch (error) {
            if (error?.code === 11000) throw new Error("Initial Super Admin setup was already claimed; no account was created.");
            throw error;
        }

        if (await User.exists({ role: "superAdmin" })) {
            throw new Error("A Super Admin was created concurrently. No account was changed.");
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await User.create({
            firstName: nameParts[0], lastName: nameParts.slice(1).join(" "), email,
            password: passwordHash, provider: "local", role: "superAdmin", isEmailVerified: true, isActive: true,
        });
        accountCreated = true;
        console.log(`Initial Super Admin created successfully for ${email} in database ${database}. The password was not displayed or stored in plaintext.`);
    } catch (error) {
        if (lockAcquired && !accountCreated) {
            try {
                if (!(await User.exists({ role: "superAdmin" }))) {
                    await mongoose.connection.db.collection(BOOTSTRAP_COLLECTION).deleteOne({ _id: BOOTSTRAP_LOCK_ID });
                }
            } catch {
                // Keep the lock if the outcome cannot be determined safely.
            }
        }
        throw error;
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error.message || "Initial Super Admin setup failed.");
    process.exitCode = 1;
});
