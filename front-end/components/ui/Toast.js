import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Text, View, StyleSheet, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// Lightweight, non-blocking toast to replace blocking alert()/Alert.alert calls.
// Usage:
//   const toast = useToast();
//   toast.success("Saved"); toast.error("Could not save"); toast.info("...")

const ToastContext = createContext({
    show: () => {},
    success: () => {},
    error: () => {},
    info: () => {},
});

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const { colors } = useTheme();
    // KIND must be built from the live palette, not the static default — a
    // toast previously always rendered girl-pink regardless of the selected
    // child's theme because this read the module-scope `colors` import.
    const KIND = useMemo(
        () => ({
            success: { icon: "checkmark-circle", color: colors.success, bg: colors.successBg },
            error: { icon: "alert-circle", color: colors.danger, bg: colors.dangerBg },
            info: { icon: "information-circle", color: colors.info, bg: colors.infoBg },
        }),
        [colors]
    );
    const [toast, setToast] = useState(null); // { message, kind }
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;
    const hideTimer = useRef(null);

    const hide = useCallback(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 20, duration: 180, useNativeDriver: true }),
        ]).start(() => setToast(null));
    }, [opacity, translateY]);

    const show = useCallback(
        (message, kind = "info", duration = 2600) => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
            setToast({ message, kind });
            opacity.setValue(0);
            translateY.setValue(20);
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 220,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
            hideTimer.current = setTimeout(hide, duration);
        },
        [opacity, translateY, hide]
    );

    const api = {
        show,
        success: (m) => show(m, "success"),
        error: (m) => show(m, "error"),
        info: (m) => show(m, "info"),
    };

    const k = toast ? KIND[toast.kind] || KIND.info : KIND.info;

    return (
        <ToastContext.Provider value={api}>
            {children}
            {toast ? (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.wrap,
                        { opacity, transform: [{ translateY }] },
                    ]}
                >
                    <View style={[styles.toast, { backgroundColor: k.bg }, shadow.raised]}>
                        <Ionicons name={k.icon} size={18} color={k.color} />
                        <Text selectable style={[styles.text, { color: k.color }]}>
                            {toast.message}
                        </Text>
                    </View>
                </Animated.View>
            ) : null}
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: "absolute",
        left: space.lg,
        right: space.lg,
        bottom: 90,
        alignItems: "center",
    },
    toast: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        maxWidth: 460,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    text: { ...type.label, flexShrink: 1 },
});

export default ToastProvider;
