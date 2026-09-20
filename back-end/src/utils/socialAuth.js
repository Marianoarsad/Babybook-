const { OAuth2Client } = require("google-auth-library");

const google = new OAuth2Client();

function googleAudiences() {
    return (process.env.GOOGLE_CLIENT_IDS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

async function verifyGoogle(idToken) {
    const audience = googleAudiences();
    if (!audience.length) throw new Error("Google sign-in is not configured");
    const ticket = await google.verifyIdToken({ idToken, audience });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) {
        throw new Error("Google did not return a verified email address");
    }
    return { provider: "google", subject: profile.sub, email: profile.email.toLowerCase(), name: profile.name || "" };
}

async function verifyFacebook(accessToken) {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Facebook sign-in is not configured");
    const version = process.env.FACEBOOK_GRAPH_VERSION || "v23.0";
    const appToken = `${appId}|${appSecret}`;
    const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", appToken);
    const debugResponse = await fetch(debugUrl);
    const debug = await debugResponse.json();
    if (!debugResponse.ok || !debug.data?.is_valid || debug.data.app_id !== appId || !debug.data.user_id) {
        throw new Error("Facebook could not verify this sign-in");
    }

    const profileUrl = new URL(`https://graph.facebook.com/${version}/${debug.data.user_id}`);
    profileUrl.searchParams.set("fields", "id,name,email");
    profileUrl.searchParams.set("access_token", accessToken);
    const profileResponse = await fetch(profileUrl);
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.id || !profile.email) {
        throw new Error("Facebook did not return an email address");
    }
    return { provider: "facebook", subject: profile.id, email: profile.email.toLowerCase(), name: profile.name || "" };
}

async function verifySocialCredential(provider, credential) {
    if (!credential) throw new Error("Missing social sign-in credential");
    if (provider === "google") return verifyGoogle(credential);
    if (provider === "facebook") return verifyFacebook(credential);
    throw new Error("Unsupported social sign-in provider");
}

module.exports = { verifySocialCredential };
