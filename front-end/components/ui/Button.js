import React from "react";
import { Text, Pressable, ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// Optional haptics (guarded so it's a no-op if expo-haptics isn't installed).
let Haptics = null;
try {
    // eslint-disable-next-line global-require
    Haptics = require("expo-haptics");
} catch (e) {
    Haptics = null;
}

const makeVariants = (colors) => ({
    primary: { bg: colors.primary, fg: colors.onPrimary, border: "transparent", elevate: true, ring: colors.primary + "59" },
    accent: { bg: colors.accentStrong, fg: colors.onAccent, border: "transparent", elevate: true, ring: colors.accentStrong + "59" },
    secondary: { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.border, elevate: false, ring: colors.primary + "4D" },
    ghost: { bg: "transparent", fg: colors.primary, border: colors.border, elevate: false, ring: colors.primary + "4D" },
    danger: { bg: colors.dangerBg, fg: colors.danger, border: colors.danger, elevate: false, ring: colors.danger + "4D" },
});

// Consistent, touch-friendly, accessible button with hover/focus/pressed states.
export default function Button({
    title,
    onPress,
    variant = "primary",
    icon,
    loading = false,
    disabled = false,
    fullWidth = true,
    style,
}) {
    const { colors } = useTheme();
    const VARIANTS = makeVariants(colors);
    const v = VARIANTS[variant] || VARIANTS.primary;
    const isDisabled = disabled || loading;

    const handlePress = (e) => {
        if (isDisabled) return;
        if (Haptics && Haptics.selectionAsync) Haptics.selectionAsync().catch(() => {});
        onPress && onPress(e);
    };

    return (
        <Pressable
            onPress={handlePress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            style={({ pressed, hovered, focused }) => [
                {
                    minHeight: MIN_TOUCH + 4,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: space.sm,
                    paddingHorizontal: space.lg,
                    borderRadius: radius.pill,
                    borderCurve: "continuous",
                    backgroundColor: v.bg,
                    borderWidth: v.border === "transparent" ? 0 : 1,
                    borderColor: v.border,
                    alignSelf: fullWidth ? "stretch" : "flex-start",
                    opacity: isDisabled ? 0.55 : hovered ? 0.94 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                },
                v.elevate && !pressed ? shadow.raised : null,
                focused ? { boxShadow: `0 0 0 3px ${v.ring}` } : null,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={v.fg} size="small" />
            ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    {icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
                    <Text style={{ ...type.label, color: v.fg }}>{title}</Text>
                </View>
            )}
        </Pressable>
    );
}
