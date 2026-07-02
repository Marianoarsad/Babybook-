import React, { useMemo } from "react";
import { View } from "react-native";
import { generateMatrix } from "../utils/qrcode";

// Renders a real, scannable QR code as a grid of Views (no native modules).
export default function QrCodeView({ value, size = 220, quietZone = 4 }) {
    const matrix = useMemo(() => {
        try {
            return generateMatrix(value || " ", "M");
        } catch (e) {
            return null;
        }
    }, [value]);

    if (!matrix) {
        return <View style={{ width: size, height: size, backgroundColor: "#FFFFFF" }} />;
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
                backgroundColor: "#FFFFFF",
                padding: pad,
            }}
        >
            {matrix.map((row, y) => (
                <View key={y} style={{ flexDirection: "row", height: cell }}>
                    {row.map((dark, x) => (
                        <View
                            key={x}
                            style={{
                                width: cell,
                                height: cell,
                                backgroundColor: dark ? "#1C1917" : "#FFFFFF",
                            }}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
}
