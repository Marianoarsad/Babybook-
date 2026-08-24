const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");

const { query } = require("../db/pool");
const { signToken } = require("../utils/jwt");
const { ApiError, asyncHandler } = require("../middleware/error");
const { handleValidation } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { encrypt, decrypt } = require("../utils/crypto");

const router = express.Router();

// The account holder's relationship to the child. Must stay identical to the
// CHECK constraint in migrations/008_user_profile.sql -- a value that passes
// here and fails there surfaces as a 500 instead of a field error.
const RELATIONSHIPS = ["mother", "father", "grandparent", "guardian", "other"];

// Annual re-consent is due if the last review was more than a year ago.
const consentReviewDue = (u) => {
    if (!u || !u.consent_reviewed_at) return false;
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    return new Date(u.consent_reviewed_at) < oneYearAgo;
};

const publicUser = (u) => ({
    id: u.id,
    fullName: decrypt(u.full_name),
    email: u.email,
    phoneNumber: decrypt(u.phone_number),
    relationship: u.relationship,
    city: decrypt(u.city),
    avatarUrl: u.avatar_url,
    consentAccepted: u.consent_accepted,
    consentDate: u.consent_date,
    retentionUntil: u.retention_until,
    consentReviewDue: consentReviewDue(u),
});

// POST /api/auth/register
router.post(
    "/register",
    [
        body("fullName").trim().notEmpty().withMessage("Full name is required"),
        body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
        body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
        // Optional here, but validated when sent: a value outside the set would
        // otherwise reach the column's CHECK constraint and surface as a 500.
        body("relationship")
            .optional({ values: "falsy" })
            .isIn(RELATIONSHIPS)
            .withMessage("Relationship must be one of: " + RELATIONSHIPS.join(", ")),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const { fullName, email, password, phoneNumber, relationship, city, consentAccepted } = req.body;
        // Data-retention & privacy consent is mandatory to register.
        if (consentAccepted !== true && consentAccepted !== "true") {
            throw new ApiError(400, "You must accept the data-retention and privacy agreement to create an account.");
        }
        const hash = await bcrypt.hash(password, 10);
        let rows;
        try {
            ({ rows } = await query(
                `INSERT INTO users
                    (full_name, email, password_hash, phone_number, relationship, city,
                     consent_accepted, consent_date, consent_reviewed_at, retention_until)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE, now(), now(), (CURRENT_DATE + INTERVAL '6 years'))
                 RETURNING *`,
                // `|| null` on every optional field: a skipped box must store
                // NULL, which the app renders as "Not recorded", rather than an
                // empty string that reads as a recorded blank.
                [
                    encrypt(fullName),
                    email,
                    hash,
                    encrypt(phoneNumber || null),
                    relationship || null,
                    encrypt(city || null),
                ]
            ));
        } catch (e) {
            if (e.code === "23505") throw new ApiError(409, "An account with that email already exists");
            throw e;
        }
        const user = rows[0];
        const token = signToken({ sub: user.id, email: user.email });
        res.status(201).json({ token, user: publicUser(user) });
    })
);

// POST /api/auth/login
router.post(
    "/login",
    [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
    handleValidation,
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
        const user = rows[0];
        if (!user) throw new ApiError(401, "Invalid email or password");
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) throw new ApiError(401, "Invalid email or password");
        const token = signToken({ sub: user.id, email: user.email });
        res.json({ token, user: publicUser(user) });
    })
);

// GET /api/auth/me
router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        res.json({ user: publicUser(rows[0]) });
    })
);

// PUT /api/auth/me — update profile (name, phone, relationship, city, avatar)
//
// Email is deliberately NOT updatable here. It is the login identity, so
// changing it needs the current password — see POST /change-email below.
const ENCRYPTED_USER_COLS = new Set(["full_name", "phone_number", "city"]);

router.put(
    "/me",
    requireAuth,
    [
        body("relationship")
            .optional({ values: "falsy" })
            .isIn(RELATIONSHIPS)
            .withMessage("Relationship must be one of: " + RELATIONSHIPS.join(", ")),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const map = {
            fullName: "full_name",
            phoneNumber: "phone_number",
            relationship: "relationship",
            city: "city",
            avatarUrl: "avatar_url",
        };
        const set = [];
        const params = [];
        for (const [key, col] of Object.entries(map)) {
            if (req.body[key] !== undefined) {
                // An emptied box clears the column rather than storing "", so
                // "cleared" and "never answered" stay the same thing.
                const raw = req.body[key] === "" ? null : req.body[key];
                params.push(ENCRYPTED_USER_COLS.has(col) ? encrypt(raw) : raw);
                set.push(`${col} = $${params.length}`);
            }
        }
        if (set.length === 0) throw new ApiError(400, "No updatable fields provided");
        params.push(req.user.id);
        const { rows } = await query(
            `UPDATE users SET ${set.join(", ")} WHERE id = $${params.length} RETURNING *`,
            params
        );
        res.json({ user: publicUser(rows[0]) });
    })
);

// POST /api/auth/forgot-password — issues a reset token (returned in dev).
router.post(
    "/forgot-password",
    [body("email").isEmail().normalizeEmail()],
    handleValidation,
    asyncHandler(async (req, res) => {
        const { email } = req.body;
        const { rows } = await query("SELECT id FROM users WHERE email = $1", [email]);
        // Always respond 200 so we don't leak which emails exist.
        if (rows[0]) {
            const token = crypto.randomBytes(24).toString("hex");
            const ttlHours = parseInt(process.env.RESET_TOKEN_TTL_HOURS || "2", 10);
            const expires = new Date(Date.now() + ttlHours * 3600 * 1000);
            await query(
                "INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)",
                [rows[0].id, token, expires]
            );
            // Send the reset email. If SMTP isn't configured it degrades to a
            // dev token so the flow still works locally.
            let sent = false;
            try {
                const result = await sendPasswordResetEmail(email, token);
                sent = result.sent;
            } catch (e) {
                console.error("[auth] reset email failed:", e.message);
            }
            const payload = { message: "If that email exists, a reset link has been sent." };
            if (!sent && process.env.NODE_ENV !== "production") payload.devToken = token;
            return res.json(payload);
        }
        res.json({ message: "If that email exists, a reset link has been sent." });
    })
);

// POST /api/auth/reset-password
router.post(
    "/reset-password",
    [
        body("token").notEmpty(),
        body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const { token, password } = req.body;
        const { rows } = await query(
            `SELECT * FROM password_resets
             WHERE token = $1 AND used = FALSE AND expires_at > now()`,
            [token]
        );
        const reset = rows[0];
        if (!reset) throw new ApiError(400, "Invalid or expired reset token");
        const hash = await bcrypt.hash(password, 10);
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, reset.user_id]);
        await query("UPDATE password_resets SET used = TRUE WHERE id = $1", [reset.id]);
        res.json({ message: "Password updated. You can now log in." });
    })
);

// POST /api/auth/change-password — verify the current password, then set a new one.
router.post(
    "/change-password",
    requireAuth,
    [
        body("currentPassword").notEmpty().withMessage("Current password is required"),
        body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        const user = rows[0];
        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) throw new ApiError(401, "Current password is incorrect");
        const hash = await bcrypt.hash(newPassword, 10);
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.id]);
        res.json({ message: "Password updated" });
    })
);

// POST /api/auth/change-email — verify the password, then move the login address.
//
// Not part of PUT /me. Email is what this account is identified by, so it must
// not change on a stray tap in a form whose other fields save silently; the
// current password is the confirmation. Modelled on change-password above.
//
// The caller's existing token keeps working: middleware/auth.js resolves the
// user from the token's `sub` (the id), so the now-stale `email` claim is never
// read and nobody is signed out by correcting their own address.
router.post(
    "/change-email",
    requireAuth,
    [
        body("newEmail").isEmail().withMessage("Valid email is required").normalizeEmail(),
        body("currentPassword").notEmpty().withMessage("Current password is required"),
    ],
    handleValidation,
    asyncHandler(async (req, res) => {
        const { newEmail, currentPassword } = req.body;
        const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!match) throw new ApiError(401, "Current password is incorrect");
        let updated;
        try {
            ({ rows: updated } = await query(
                "UPDATE users SET email = $1 WHERE id = $2 RETURNING *",
                [newEmail, req.user.id]
            ));
        } catch (e) {
            // Same wording register uses, so one address already in use reads
            // the same way wherever the parent meets it.
            if (e.code === "23505") throw new ApiError(409, "An account with that email already exists");
            throw e;
        }
        res.json({ user: publicUser(updated[0]) });
    })
);

// POST /api/auth/consent/renew — annual re-consent: the user confirms they
// still want their data retained for another year.
router.post(
    "/consent/renew",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { rows } = await query(
            "UPDATE users SET consent_reviewed_at = now() WHERE id = $1 RETURNING *",
            [req.user.id]
        );
        res.json({ user: publicUser(rows[0]) });
    })
);

// DELETE /api/auth/me — withdraw consent and permanently delete the account and
// all associated child data (ON DELETE CASCADE removes everything).
router.delete(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
        await query("DELETE FROM users WHERE id = $1", [req.user.id]);
        res.status(204).end();
    })
);

module.exports = router;
