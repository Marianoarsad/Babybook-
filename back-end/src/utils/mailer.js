// Sends transactional email via nodemailer.
// If SMTP isn't configured, it degrades gracefully (logs the link and lets the
// caller fall back to returning a dev token), so the app still works in dev.

const nodemailer = require("nodemailer");

let transporter = null;
let resolved = false;

function getTransporter() {
    if (resolved) return transporter;
    resolved = true;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER) {
        transporter = null;
        return null;
    }
    const port = parseInt(SMTP_PORT || "587", 10);
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return transporter;
}

async function sendPasswordResetEmail(to, token) {
    const base = (process.env.APP_RESET_URL || "http://localhost:8081/reset").replace(/\/$/, "");
    const link = `${base}?token=${token}`;
    const ttl = process.env.RESET_TOKEN_TTL_HOURS || 2;

    const t = getTransporter();
    if (!t) {
        console.log(`[mailer] SMTP not configured. Reset link for ${to}: ${link}`);
        return { sent: false, link };
    }

    await t.sendMail({
        from: process.env.MAIL_FROM || "BabyBook+ <no-reply@babybook.app>",
        to,
        subject: "Reset your BabyBook+ password",
        text: `You requested a password reset for BabyBook+.\n\nUse this link (valid ${ttl} hours): ${link}\n\nOr enter this code in the app: ${token}\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>You requested a password reset for <b>BabyBook+</b>.</p>
               <p><a href="${link}">Click here to reset your password</a> (valid ${ttl} hours).</p>
               <p>Or enter this code in the app: <b>${token}</b></p>
               <p style="color:#888">If you didn't request this, you can ignore this email.</p>`,
    });
    return { sent: true, link };
}

module.exports = { sendPasswordResetEmail };
