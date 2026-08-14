import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { seen, markSeen } from "../../utils/firstRun";

// One-time, dismissible tip shown the first time a parent opens a screen.
// Each `tipKey` is independent (dismissing Health's tip doesn't touch
// Growth's) and never reappears once dismissed — see utils/firstRun.js.
// Renders null while the "have I been seen?" check resolves and forever
// after dismissal, so it never flashes or pops back in.
export default function TipStrip({ tipKey, children }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let active = true;
        seen(tipKey).then((wasSeen) => {
            if (active && !wasSeen) setVisible(true);
        });
        return () => {
            active = false;
        };
    }, [tipKey]);

    if (!visible) return null;

    const dismiss = () => {
        setVisible(false);
        markSeen(tipKey);
    };

    return (
        <View style={styles.strip}>
            <Ionicons name="bulb-outline" size={18} color={colors.info} style={styles.icon} />
            <Text style={styles.text}>{children}</Text>
            <TouchableOpacity
                onPress={dismiss}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Dismiss tip"
                hitSlop={8}
            >
                <Ionicons name="close" size={16} color={colors.info} />
            </TouchableOpacity>
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        strip: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.sm,
            backgroundColor: colors.infoBg,
            borderRadius: radius.md,
            borderCurve: "continuous",
            padding: space.md,
            margin: space.md,
            marginBottom: space.sm,
        },
        icon: { marginTop: 1 },
        text: { ...type.body, color: colors.info, flex: 1, lineHeight: 19 },
        closeBtn: {
            width: MIN_TOUCH * 0.6,
            height: MIN_TOUCH * 0.6,
            alignItems: "center",
            justifyContent: "center",
            marginTop: -space.xs,
            marginRight: -space.xs,
        },
    });
