import React from "react";
import { View, Text, TextInput } from "react-native";
import { radius, space, type } from "../../theme";
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
}) {
    const { colors } = useTheme();
    return (
        <View style={[{ gap: space.xs, marginBottom: space.md }, style]}>
            {label ? (
                <Text style={{ ...type.label, color: colors.textSecondary }}>
                    {label}
                </Text>
            ) : null}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
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
                    fontSize: type.body.fontSize,
                    fontFamily: type.body.fontFamily,
                    color: colors.text,
                    textAlignVertical: multiline ? "top" : "center",
                }}
            />
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
