import React from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

// Keeps the focused input above the keyboard inside forms/modals. iOS gets
// the real behavior (native Android already gets this for free from Expo's
// default softwareKeyboardLayoutMode: "resize" — forcing a `behavior` there
// fights adjustResize and causes jumpiness, so it's left alone). Web is a
// plain View: RNW's KeyboardAvoidingView measures a keyboard frame that
// never exists there.
export default function KeyboardAvoider({ children, style, keyboardVerticalOffset = 0 }) {
    if (Platform.OS === "ios") {
        return (
            <KeyboardAvoidingView
                behavior="padding"
                style={[{ flex: 1 }, style]}
                keyboardVerticalOffset={keyboardVerticalOffset}
            >
                {children}
            </KeyboardAvoidingView>
        );
    }
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
}
