import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import numericInput from "../../utils/numericInput.cjs";

const { decimalOnly, digitsOnly } = numericInput;

export function FieldShell({ label, required = false, focused = false, disabled = false,
    error, helper, multiline = false, style, children }) {
    const { colors } = useTheme();
    const hasError = !!error;
    const borderColor = hasError ? colors.danger : disabled ? colors.border
        : focused ? colors.text : colors.borderStrong;
    const labelColor = hasError ? colors.danger : disabled ? colors.placeholder : colors.textSecondary;

    return <View style={[{ marginBottom: space.md }, style]}>
        <View style={{ minHeight: multiline ? 96 : 52, position: "relative",
            justifyContent: multiline ? "flex-start" : "center", backgroundColor: colors.surface,
            borderWidth: focused || hasError ? 1.5 : 1, borderColor, borderRadius: radius.lg,
            borderCurve: "continuous" }}>
            {label ? <View pointerEvents="none" style={{ position: "absolute", zIndex: 1, top: -9,
                left: space.md, maxWidth: "86%", paddingHorizontal: space.xs, backgroundColor: colors.surface }}>
                <Text numberOfLines={1} style={{ ...type.caption, fontWeight: "700", color: labelColor }}>
                    {label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
                </Text>
            </View> : null}
            {children}
        </View>
        {hasError && typeof error === "string" ? <Text selectable accessibilityRole="alert"
            style={{ ...type.caption, color: colors.danger, marginTop: space.xs }}>{error}</Text>
            : helper ? <Text style={{ ...type.caption, color: colors.textMuted, marginTop: space.xs }}>{helper}</Text> : null}
    </View>;
}

// Shared floating-label text field. Numeric filtering, autofill and secure-entry
// behaviour stay here so every form gets the same visuals without duplicating logic.
export default function Field({ label, value, onChangeText, placeholder, prefix, error, helper,
    required = false, keyboardType, secureTextEntry, autoCapitalize, multiline, style, inputStyle,
    autoComplete, textContentType, inputMode, numericMode, maxLength, editable = true,
    hideReveal = false, leading, onFocus, onBlur }) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const canReveal = !!secureTextEntry && !hideReveal;

    return <FieldShell label={label} required={required} focused={focused} disabled={!editable}
        error={error} helper={helper} multiline={multiline} style={style}>
        <View style={{ flex: 1, justifyContent: multiline ? "flex-start" : "center" }}>
            <TextInput
                value={value}
                onChangeText={(next) => onChangeText?.(numericMode === "digits" ? digitsOnly(next)
                    : numericMode === "decimal" ? decimalOnly(next) : next)}
                onFocus={(event) => { setFocused(true); onFocus?.(event); }}
                onBlur={(event) => { setFocused(false); onBlur?.(event); }}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType={keyboardType || (numericMode === "digits" ? "number-pad" : numericMode === "decimal" ? "decimal-pad" : undefined)}
                secureTextEntry={!!secureTextEntry && !revealed}
                autoCapitalize={autoCapitalize}
                multiline={multiline}
                autoComplete={autoComplete}
                textContentType={textContentType}
                inputMode={inputMode || (numericMode === "digits" ? "numeric" : numericMode === "decimal" ? "decimal" : undefined)}
                maxLength={maxLength}
                editable={editable}
                accessibilityLabel={label}
                accessibilityHint={prefix ? `${prefix} is added automatically` : undefined}
                style={[{ minHeight: multiline ? 94 : 50,
                    paddingLeft: prefix ? space.lg + 30 : leading ? MIN_TOUCH : space.lg,
                    paddingRight: canReveal ? MIN_TOUCH + space.xs : space.lg,
                    paddingTop: multiline ? space.lg : 0, paddingBottom: multiline ? space.md : 0,
                    fontSize: type.body.fontSize, fontFamily: type.body.fontFamily,
                    color: editable ? colors.text : colors.placeholder, textAlignVertical: multiline ? "top" : "center",
                    backgroundColor: "transparent", borderWidth: 0 }, inputStyle]}
            />
            {prefix ? <View pointerEvents="none" style={{ position: "absolute", left: space.lg,
                top: 0, bottom: 0, justifyContent: "center" }}>
                <Text style={{ ...type.body, color: editable ? colors.text : colors.placeholder }}>{prefix}</Text>
            </View> : null}
            {leading && !prefix ? <View pointerEvents="none" style={{ position: "absolute", left: 0,
                top: 0, bottom: 0, width: MIN_TOUCH, alignItems: "center", justifyContent: "center" }}>{leading}</View> : null}
            {canReveal ? <TouchableOpacity onPress={() => setRevealed((current) => !current)}
                accessibilityRole="button" accessibilityState={{ selected: revealed }}
                accessibilityLabel={revealed ? "Hide password" : "Show password"} hitSlop={6}
                style={{ position: "absolute", right: 0, width: MIN_TOUCH, height: MIN_TOUCH,
                    alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={19} color={colors.textMuted} />
            </TouchableOpacity> : null}
        </View>
    </FieldShell>;
}
