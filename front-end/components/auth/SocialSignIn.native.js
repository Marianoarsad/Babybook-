import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
    GoogleOneTapSignIn,
    isCancelledResponse,
    isNoSavedCredentialFoundResponse,
    isSuccessResponse,
} from "react-native-nitro-google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { useTheme } from "../../context/ThemeContext";
import { radius, space, type } from "../../theme";
import PulseLoader from "../ui/PulseLoader";

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
if (googleClientId) GoogleOneTapSignIn.configure({ webClientId: googleClientId });

export default function SocialSignIn({ onCredential, onError, loadingProvider }) {
    const { colors } = useTheme();

    const googleSignIn = async () => {
        try {
            await GoogleOneTapSignIn.checkPlayServices();
            let response = await GoogleOneTapSignIn.signIn();
            if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
            if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.presentExplicitSignIn();
            if (isCancelledResponse(response)) return;
            if (!isSuccessResponse(response)) throw new Error("Google sign-in did not complete");
            await onCredential("google", response.data.idToken);
        } catch (error) {
            onError(error);
        }
    };

    const facebookSignIn = async () => {
        try {
            const result = await LoginManager.logInWithPermissions(["public_profile", "email"]);
            if (result.isCancelled) return;
            const data = await AccessToken.getCurrentAccessToken();
            if (!data?.accessToken) throw new Error("Facebook sign-in did not complete");
            await onCredential("facebook", data.accessToken);
        } catch (error) {
            onError(error);
        }
    };

    const providers = [
        { key: "google", label: "Continue with Google", icon: "logo-google", ready: !!googleClientId, press: googleSignIn },
        { key: "facebook", label: "Continue with Facebook", icon: "logo-facebook", ready: !!facebookAppId, press: facebookSignIn },
    ];
    const setupPending = __DEV__ && providers.some((provider) => !provider.ready);

    return (
        <View style={{ alignItems: "center", gap: space.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: space.md }}>
                {providers.map((provider) => {
                    if (!provider.ready && !__DEV__) return null;
                    const busy = loadingProvider === provider.key;
                    return (
                        <TouchableOpacity
                            key={provider.key}
                            onPress={provider.press}
                            disabled={!provider.ready || !!loadingProvider}
                            accessibilityRole="button"
                            accessibilityLabel={provider.label}
                            accessibilityState={{ disabled: !provider.ready || !!loadingProvider, busy }}
                            style={{
                                width: 64,
                                minHeight: 52,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: radius.md,
                                backgroundColor: colors.surfaceAlt,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: provider.ready ? 1 : 0.5,
                            }}
                        >
                            {busy ? <PulseLoader size={22} /> : <Ionicons name={provider.icon} size={22} color={colors.text} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
            {setupPending ? <Text style={{ ...type.caption, color: colors.textMuted }}>Social sign-in setup pending</Text> : null}
        </View>
    );
}
