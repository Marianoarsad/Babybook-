import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

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
    const [granted, setGranted] = useState(null);
    const [scanned, setScanned] = useState(false);

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
                    onScanned(data);
                }}
            />
            <View style={styles.overlay}>
                <Text style={styles.hint}>Point the camera at the parent's QR code</Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1, backgroundColor: "#000000" },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#FFFDF9",
    },
    msg: { fontSize: 14, color: "#57534E", textAlign: "center", marginBottom: 16, lineHeight: 20 },
    link: { fontSize: 13, color: "#456155", fontWeight: "700" },
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
    cancelText: { color: "#1C1917", fontWeight: "800", fontSize: 14 },
});
