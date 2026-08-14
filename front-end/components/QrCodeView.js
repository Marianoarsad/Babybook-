import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { generateMatrix } from "../utils/qrcode";
import { radius, space, type } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Fixed light-mode ink/paper — a QR code must always render dark modules on
// a light background regardless of the app's theme (dark mode included).
// Letting these follow useTheme() would invert to light-on-dark once dark
// mode ships, which risks unreadability on cheap scanners. Not derived from
// theme.js on purpose, so a future palette change can never touch them.
const QR_INK = "#16202A";
const QR_PAPER = "#FFFFFF";

// Renders a real, scannable QR code as a grid of Views (no native modules).
// `dark`/`light` let the caller override the ink/paper (default: QR_INK on
// QR_PAPER — verified 16.48:1, far above the ~3:1 a scanner needs; do NOT
// default to a brand or theme color here, some cheap scanners choke on
// tinted modules and there's no benefit to the risk).
export default function QrCodeView({ value, size = 220, quietZone = 4, dark, light }) {
    const { colors } = useTheme();
    const ink = dark || QR_INK;
    const paper = light || QR_PAPER;

    const matrix = useMemo(() => {
        try {
            return generateMatrix(value || " ", "M");
        } catch (e) {
            return null;
        }
    }, [value]);

    if (!matrix) {
        return (
            <View
                style={[
                    styles.failBox,
                    { width: size, height: size, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
                ]}
            >
                <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
                <Text style={[styles.failText, { color: colors.textSecondary }]}>
                    Could not render QR — use the code below.
                </Text>
            </View>
        );
    }

    const n = matrix.length;
    const cell = Math.max(2, Math.floor(size / (n + quietZone * 2)));
    const pad = cell * quietZone;
    const dim = cell * n + pad * 2;

    return (
        <View
            style={{
                width: dim,
                height: dim,
                backgroundColor: paper,
                padding: pad,
            }}
        >
            {matrix.map((row, y) => (
                <View key={y} style={{ flexDirection: "row", height: cell }}>
                    {row.map((d, x) => (
                        <View
                            key={x}
                            style={{
                                width: cell,
                                height: cell,
                                backgroundColor: d ? ink : paper,
                            }}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    failBox: {
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        padding: space.lg,
        gap: space.sm,
    },
    failText: { ...type.caption, textAlign: "center" },
});
