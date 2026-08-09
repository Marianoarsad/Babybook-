import React, { useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// Shared "show 10 more" button for every capped record list in the app
// (Health's five lists, Growth's memories, All Activity/All Memories, Share
// Records' history + log, Nutrition). Lifted out of NutritionTracker.js,
// which had its own copy of this exact button before other lists needed it
// too. Renders nothing once everything is already visible.
export default function ShowMore({ total, visible, onPress, noun = "items" }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (total <= visible) return null;
    const remaining = total - visible;
    return (
        <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Show more ${noun}`}
        >
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
            <Text style={styles.loadMoreText}>
                Show more ({remaining} remaining)
            </Text>
        </TouchableOpacity>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        loadMoreBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: space.sm,
            paddingVertical: 12,
            borderRadius: radius.md,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.softGreen,
        },
        loadMoreText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    });
