import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { radius, space, type } from "../../theme";
import PulseLoader from "../ui/PulseLoader";

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
const facebookVersion = process.env.EXPO_PUBLIC_FACEBOOK_GRAPH_VERSION || "v23.0";

function loadScript(id, src) {
    return new Promise((resolve, reject) => {
        const current = document.getElementById(id);
        if (current) {
            if (current.dataset.loaded) resolve();
            else current.addEventListener("load", resolve, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => { script.dataset.loaded = "true"; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

export default function SocialSignIn({ onCredential, onError, loadingProvider }) {
    const { colors } = useTheme();
    const googleRef = useRef(null);
    const [googleReady, setGoogleReady] = useState(false);
    const [facebookReady, setFacebookReady] = useState(false);

    useEffect(() => {
        if (googleClientId) {
            loadScript("google-identity-services", "https://accounts.google.com/gsi/client")
                .then(() => setGoogleReady(true))
                .catch(() => onError(new Error("Google sign-in could not load")));
        }
        if (facebookAppId) {
            loadScript("facebook-jssdk", "https://connect.facebook.net/en_US/sdk.js")
                .then(() => {
                    window.FB.init({ appId: facebookAppId, cookie: true, xfbml: false, version: facebookVersion });
                    setFacebookReady(true);
                })
                .catch(() => onError(new Error("Facebook sign-in could not load")));
        }
    }, [onError]);

    useEffect(() => {
        if (!googleReady || !googleRef.current) return;
        window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: ({ credential }) => credential && onCredential("google", credential),
        });
        googleRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleRef.current, {
            type: "icon",
            theme: "outline",
            size: "large",
            shape: "square",
        });
    }, [googleReady, loadingProvider, onCredential]);

    const facebookSignIn = () => {
        if (!facebookReady) return;
        window.FB.login(
            (response) => response.authResponse?.accessToken && onCredential("facebook", response.authResponse.accessToken),
            { scope: "public_profile,email" }
        );
    };

    const setupPending = __DEV__ && (!googleClientId || !facebookAppId);
    return (
        <View style={{ alignItems: "center", gap: space.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.md }}>
                {googleClientId ? (
                    <View
                        accessibilityRole="button"
                        accessibilityLabel="Continue with Google"
                        style={{ width: 64, minHeight: 52, alignItems: "center", justifyContent: "center", opacity: loadingProvider && loadingProvider !== "google" ? 0.5 : 1 }}
                    >
                        {loadingProvider === "google" ? <PulseLoader size={22} /> : React.createElement("div", { ref: googleRef })}
                    </View>
                ) : __DEV__ ? <Unavailable label="Continue with Google" icon="logo-google" colors={colors} /> : null}
                {facebookAppId ? (
                    <TouchableOpacity
                        onPress={facebookSignIn}
                        disabled={!facebookReady || !!loadingProvider}
                        accessibilityRole="button"
                        accessibilityLabel="Continue with Facebook"
                        accessibilityState={{ disabled: !facebookReady || !!loadingProvider, busy: loadingProvider === "facebook" }}
                        style={{ width: 64, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", opacity: facebookReady ? 1 : 0.5 }}
                    >
                        {loadingProvider === "facebook" ? <PulseLoader size={22} /> : <Ionicons name="logo-facebook" size={22} color={colors.text} />}
                    </TouchableOpacity>
                ) : __DEV__ ? <Unavailable label="Continue with Facebook" icon="logo-facebook" colors={colors} /> : null}
            </View>
            {setupPending ? <Text style={{ ...type.caption, color: colors.textMuted }}>Social sign-in setup pending</Text> : null}
        </View>
    );
}

function Unavailable({ label, icon, colors }) {
    return (
        <View accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: true }} style={{ width: 64, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
            <Ionicons name={icon} size={22} color={colors.textMuted} />
        </View>
    );
}
