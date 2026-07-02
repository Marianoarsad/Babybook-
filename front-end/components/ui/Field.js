import React from "react";
import { View, Text, TextInput } from "react-native";
import { colors, radius, space } from "../../theme";

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
}) {
    return (
        <View style={[{ gap: space.xs, marginBottom: space.md }, style]}>
            {label ? (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>
                    {label}
                </Text>
            ) : null}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
                autoCapitalize={autoCapitalize}
                multiline={multiline}
                accessibilityLabel={label}
                style={{
                    minHeight: 52,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: error ? colors.danger : colors.border,
                    borderRadius: radius.lg,
                    borderCurve: "continuous",
                    paddingHorizontal: space.lg,
                    paddingVertical: multiline ? space.md : 0,
                    fontSize: 15,
                    color: colors.text,
                    textAlignVertical: multiline ? "top" : "center",
                }}
            />
            {error ? (
                <Text selectable style={{ fontSize: 12.5, color: colors.danger, fontWeight: "600" }}>
                    {error}
                </Text>
            ) : helper ? (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{helper}</Text>
            ) : null}
        </View>
    );
}
