// SECURE ONE-TIME SUPER ADMIN SETUP SCRIPT
// Interactive: node scripts/setup-super-admin.js (prompts with hidden password)
// Piped: cat input.txt | node scripts/setup-super-admin.js
// Creates the first Super Admin account if none exists.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Apply DNS override for MongoDB SRV lookup (same as backend index.js)
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const isTTY = process.stdin.isTTY;

async function readLine(prompt, hide = false) {
    if (hide && isTTY) {
        return new Promise((resolve) => {
            process.stdout.write(prompt);
            const stdin = process.openStdin();
            stdin.setRawMode(true);
            let input = "";
            stdin.on("data", (char) => {
                const c = char.toString();
                if (c === "\n" || c === "\r") {
                    process.stdout.write("\n");
                    stdin.pause();
                    stdin.setRawMode(false);
                    stdin.removeAllListeners("data");
                    resolve(input);
                } else if (c === "\u0003") {
                    process.exit();
                } else if (c === "\u007f" || c === "\b") {
                    if (input.length > 0) {
                        input = input.slice(0, -1);
                        process.stdout.write("\b \b");
                    }
                } else {
                    input += c;
                    process.stdout.write("*");
                }
            });
        });
    }
    // Non-TTY: read a line from stdin using readline
    return new Promise((resolve, reject) => {
        const readline = require("node:readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function readAllLines() {
    const readline = require("node:readline");
    const rl = readline.createInterface({ input: process.stdin });
    const lines = [];
    for await (const line of rl) {
        lines.push(line);
    }
    return lines;
}

async function main() {
    try {
        console.log("=== Royal HigherLife Super Admin Setup ===\n");
        console.log("This script creates the first Super Admin account.");
        console.log("If a Super Admin already exists, this will abort.\n");

        await mongoose.connect(
            "mongodb+srv://royalhigherlife:royalhigherlife@cluster0.x357aur.mongodb.net/royal_higherlife",
            { serverSelectionTimeoutMS: 10000 }
        );

        const User = require("../Models/user");

        // Prevent duplicate initial setup: check if any admin exists
        const existingAdmin = await User.findOne({
            role: { $in: ["admin", "superAdmin", "contentAdmin", "mediaAdmin", "ministryAdmin"] },
        });
        if (existingAdmin) {
            console.log("\nAborted: An administrator account already exists.");
            console.log("Email:", existingAdmin.email, "| Role:", existingAdmin.role);
            await mongoose.disconnect();
            if (!isTTY) process.exit(0);
            return;
        }

        let firstName, lastName, email, password, confirmPassword;

        if (!isTTY) {
            // Piped input: read all lines at once
            const lines = await readAllLines();
            firstName = (lines[0] || "").trim();
            lastName = (lines[1] || "").trim();
            email = (lines[2] || "").trim().toLowerCase();
            phone = (lines[3] || "").trim();
            password = (lines[4] || "");
            confirmPassword = (lines[5] || "");
        } else {
            firstName = (await readLine("First name: ")).trim();
            lastName = (await readLine("Last name: ")).trim();
            email = (await readLine("Email address: ")).trim().toLowerCase();
            phone = (await readLine("Phone number (e.g. +2348012345678): ")).trim();
            password = await readLine("Password: ", true);
            confirmPassword = await readLine("Confirm password: ", true);
        }

        // Validate
        if (!firstName || !lastName) {
            console.log("\nError: First name and last name are required.");
            await mongoose.disconnect();
            if (!isTTY) process.exit(1);
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.log("\nError: Invalid email address.");
            await mongoose.disconnect();
            if (!isTTY) process.exit(1);
            return;
        }
        if (!/^\+?[\d\s\-\(\)]{5,40}$/.test(phone)) {
            console.log("\nError: Invalid phone number.");
            await mongoose.disconnect();
            if (!isTTY) process.exit(1);
            return;
        }
        if (typeof password !== "string" || password.length < 8 || password.length > 128) {
            console.log("\nError: Password must be between 8 and 128 characters.");
            await mongoose.disconnect();
            if (!isTTY) process.exit(1);
            return;
        }
        if (password !== confirmPassword) {
            console.log("\nError: Passwords do not match.");
            await mongoose.disconnect();
            if (!isTTY) process.exit(1);
            return;
        }

        // Check for duplicate email
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            console.log("\nError: An account with this email already exists.");
            await mongoose.disconnect();
            if (!isTTY) process.exit(1);
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            firstName,
            lastName,
            email,
            phone,
            password: hashedPassword,
            country: "",
            state: "",
            gender: "",
            newsletter: false,
            role: "superAdmin",
            isActive: true,
            isEmailVerified: true,
        });

        console.log("\n=== Super Admin account created ===");
        console.log("Name:", user.firstName + " " + user.lastName);
        console.log("Email:", user.email);
        console.log("Role:", user.role);
        console.log("Active:", user.isActive);
        console.log("Email verified:", user.isEmailVerified);
        console.log("\nYou can now sign in at /admin/login");

        await mongoose.disconnect();
        if (!isTTY) process.exit(0);
    } catch (error) {
        console.error("\nSetup failed:", error.message);
        try { await mongoose.disconnect(); } catch (_) {}
        process.exit(1);
    }
}

main();
