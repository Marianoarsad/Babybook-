const base = require("./app.json");

const plugins = [...base.expo.plugins];
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
const facebookClientToken = process.env.FACEBOOK_CLIENT_TOKEN;

if (facebookAppId && facebookClientToken) {
    plugins.push([
        "react-native-fbsdk-next",
        {
            appID: facebookAppId,
            clientToken: facebookClientToken,
            displayName: "BabyBook+",
            scheme: `fb${facebookAppId}`,
            advertiserIDCollectionEnabled: false,
            autoLogAppEventsEnabled: false,
            isAutoInitEnabled: true,
        },
    ]);
}

module.exports = { ...base, expo: { ...base.expo, plugins } };
