import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import { useTheme } from "../context/ThemeContext";

// Guarded import so the app runs even if expo-camera isn't installed.
let ExpoCamera = null;
try {
    // eslint-disable-next-line global-require
    ExpoCamera = require("expo-camera");
} catch (e) {
    ExpoCamera = null;
}

export function scannerAvailable() {
    return !!(ExpoCamera && ExpoCamera.CameraView);
}

// Fullscreen camera that scans a QR code and calls onScanned(data).
export default function QrScanner({ onScanned, onClose }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [granted, setGranted] = useState(null);
    const [scanned, setScanned] = useState(false);
    const flashAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (!ExpoCamera || !ExpoCamera.requestCameraPermissionsAsync) {
                    if (active) setGranted(false);
                    return;
                }
                const res = await ExpoCamera.requestCameraPermissionsAsync();
                if (active) setGranted(!!res.granted);
            } catch (e) {
                if (active) setGranted(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    if (!ExpoCamera || !ExpoCamera.CameraView) {
        return (
            <View style={styles.center}>
                <Text style={styles.msg}>
                    Camera scanning isn't available here. Please enter the code manually.
                </Text>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.link}>Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (granted === null) {
        return <View style={styles.fill} />;
    }

    if (!granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.msg}>
                    Camera permission was denied. Please enter the code manually.
                </Text>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.link}>Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const CameraView = ExpoCamera.CameraView;
    return (
        <View style={styles.fill}>
            <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                    if (scanned) return;
                    setScanned(true);
                    Animated.sequence([
                        Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: Platform.OS !== "web" }),
                        Animated.timing(flashAnim, { toValue: 0, duration: 280, useNativeDriver: Platform.OS !== "web" }),
                    ]).start();
                    // Let the flash play before handing off — the caller
                    // typically unmounts this screen the instant onScanned fires.
                    setTimeout(() => onScanned(data), 260);
                }}
            />
            <View style={styles.viewfinder} pointerEvents="none">
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none" />
            </View>
            <View style={styles.overlay}>
                <Text style={styles.hint}>Point the camera at the parent's QR code</Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    fill: { flex: 1, backgroundColor: "#000000" },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.background,
    },
    msg: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 16, lineHeight: 20 },
    link: { fontSize: 13, color: colors.primary, fontWeight: "700" },
    viewfinder: {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 240,
        height: 240,
        marginLeft: -120,
        marginTop: -120,
    },
    corner: { position: "absolute", width: 32, height: 32, borderColor: "#FFFFFF" },
    cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
    flash: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.success,
        borderRadius: 12,
    },
    overlay: {
        position: "absolute",
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: "center",
        gap: 14,
    },
    hint: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
        backgroundColor: "rgba(0,0,0,0.5)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: "hidden",
    },
    cancelBtn: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    cancelText: { color: colors.text, fontWeight: "800", fontSize: 14 },
});
