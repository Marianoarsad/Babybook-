import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// Accessible labelled text field with inline error + helper text.
// Replaces bare TextInputs and alert()-based validation.
export default function Field({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    helper,
    keyboardType,
    secureTextEntry,
    autoCapitalize,
    multiline,
    style,
    // Autofill metadata. Nothing offered these before, so a password manager
    // could neither fill the sign-in form nor offer to save a new account's
    // credentials — the parent had to type an address and a password by hand on
    // a phone keyboard, which is how a mistyped email (the only route back into
    // an account) gets in. RN maps `autoComplete` on Android and the web;
    // `textContentType` is the iOS half, and callers pass both.
    autoComplete,
    textContentType,
    inputMode,
    maxLength,
    // Suppresses the reveal control on a secure field. The sign-in password box
    // does not need it — you are typing a string you already know — while a
    // confirm box on a signup form very much does.
    hideReveal = false,
}) {
    const { colors } = useTheme();
    // A secure field a parent cannot read is how a mismatch between Password
    // and Confirm survives to the submit button. Starts hidden, always.
    const [revealed, setRevealed] = useState(false);
    const canReveal = !!secureTextEntry && !hideReveal;

    return (
        <View style={[{ gap: space.xs, marginBottom: space.md }, style]}>
            {label ? (
                <Text style={{ ...type.label, color: colors.textSecondary }}>
                    {label}
                </Text>
            ) : null}
            <View style={{ justifyContent: "center" }}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.placeholder}
                    keyboardType={keyboardType}
                    secureTextEntry={!!secureTextEntry && !revealed}
                    autoCapitalize={autoCapitalize}
                    multiline={multiline}
                    autoComplete={autoComplete}
                    textContentType={textContentType}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    accessibilityLabel={label}
                    style={{
                        minHeight: 52,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: error ? colors.danger : colors.border,
                        borderRadius: radius.lg,
                        borderCurve: "continuous",
                        paddingLeft: space.lg,
                        // Room for the reveal button so a long password never
                        // runs underneath it.
                        paddingRight: canReveal ? MIN_TOUCH + space.xs : space.lg,
                        paddingVertical: multiline ? space.md : 0,
                        fontSize: type.body.fontSize,
                        fontFamily: type.body.fontFamily,
                        color: colors.text,
                        textAlignVertical: multiline ? "top" : "center",
                    }}
                />
                {canReveal ? (
                    <TouchableOpacity
                        onPress={() => setRevealed((v) => !v)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: revealed }}
                        accessibilityLabel={revealed ? "Hide password" : "Show password"}
                        hitSlop={6}
                        style={{
                            position: "absolute",
                            right: 0,
                            width: MIN_TOUCH,
                            height: MIN_TOUCH,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Ionicons
                            name={revealed ? "eye-off-outline" : "eye-outline"}
                            size={19}
                            color={colors.textMuted}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>
            {error ? (
                <Text selectable style={{ ...type.caption, color: colors.danger }}>
                    {error}
                </Text>
            ) : helper ? (
                <Text style={{ ...type.caption, color: colors.textMuted }}>{helper}</Text>
            ) : null}
        </View>
    );
}
