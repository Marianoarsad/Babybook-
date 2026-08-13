import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { generateMatrix } from "../utils/qrcode";
import { radius, space, type } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Renders a real, scannable QR code as a grid of Views (no native modules).
// `dark`/`light` let the caller theme the ink/paper (default: colors.text on
// colors.surface — verified 16.48:1, far above the ~3:1 a scanner needs; do
// NOT default to a brand color here, some cheap scanners choke on tinted
// modules and there's no benefit to the risk).
export default function QrCodeView({ value, size = 220, quietZone = 4, dark, light }) {
    const { colors } = useTheme();
    const ink = dark || colors.text;
    const paper = light || colors.surface;

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
