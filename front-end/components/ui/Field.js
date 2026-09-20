import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { useRecordForm } from "./RecordFormSheet";

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
    editable = true,
    // Suppresses the reveal control on a secure field. The sign-in password box
    // does not need it — you are typing a string you already know — while a
    // confirm box on a signup form very much does.
    hideReveal = false,
}) {
    const { colors } = useTheme();
    const recordForm = useRecordForm();
    const [fieldWidth, setFieldWidth] = useState(0);
    const row = recordForm && !multiline && (fieldWidth === 0 || fieldWidth >= 280);
    // A secure field a parent cannot read is how a mismatch between Password
    // and Confirm survives to the submit button. Starts hidden, always.
    const [revealed, setRevealed] = useState(false);
    const canReveal = !!secureTextEntry && !hideReveal;

    return (
        <View onLayout={recordForm ? (event) => setFieldWidth(event.nativeEvent.layout.width) : undefined}
            style={[{ gap: recordForm ? space.sm : space.xs, marginBottom: space.md },
                recordForm && { flexDirection: row ? "row" : "column", flexWrap: "wrap", alignItems: row ? "center" : "stretch",
                    paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: colors.hairline }, style]}>
            {label ? (
                <Text style={{ ...type.label, color: recordForm ? colors.text : colors.textSecondary, ...(row ? { flex: 1 } : {}) }}>
                    {label}
                </Text>
            ) : null}
            <View style={{ justifyContent: "center", ...(row ? { flex: 1.35, minWidth: 0 } : {}) }}>
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
                    editable={editable}
                    accessibilityLabel={label}
                    style={{
                        minHeight: 52,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: recordForm && !error ? 0 : 1,
                        borderColor: error ? colors.danger : colors.border,
                        borderRadius: radius.lg,
                        borderCurve: "continuous",
                        paddingLeft: recordForm ? space.md : space.lg,
                        // Room for the reveal button so a long password never
                        // runs underneath it.
                        paddingRight: canReveal ? MIN_TOUCH + space.xs : space.lg,
                        paddingVertical: multiline ? space.md : 0,
                        fontSize: type.body.fontSize,
                        fontFamily: type.body.fontFamily,
                        color: colors.text,
                        opacity: editable ? 1 : 0.72,
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
                <Text selectable style={{ ...type.caption, color: colors.danger, ...(row ? { flexBasis: "100%" } : {}) }}>
                    {error}
                </Text>
            ) : helper ? (
                <Text style={{ ...type.caption, color: colors.textMuted, ...(row ? { flexBasis: "100%" } : {}) }}>{helper}</Text>
            ) : null}
        </View>
    );
}
