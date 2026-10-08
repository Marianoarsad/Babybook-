const jwt = require("jsonwebtoken");

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set");
    return secret;
}

function signToken(payload) {
    return jwt.sign(payload, getSecret(), {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
}

function verifyToken(token) {
    return jwt.verify(token, getSecret());
}

function signSocialToken(payload) {
    return jwt.sign({ ...payload, purpose: "social-auth" }, getSecret(), {
        audience: "babybook-social-registration",
        expiresIn: "5m",
    });
}

function verifySocialToken(token) {
    const payload = jwt.verify(token, getSecret(), {
        audience: "babybook-social-registration",
    });
    if (payload.purpose !== "social-auth") throw new Error("Invalid social sign-in token");
    return payload;
}

module.exports = { signToken, verifyToken, signSocialToken, verifySocialToken };
