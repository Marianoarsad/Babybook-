import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Text, View, StyleSheet, Easing, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// Guarded expo-haptics, same pattern as ui/Button.js — a no-op if the
// module isn't available rather than a crash.
let Haptics = null;
try {
    // eslint-disable-next-line global-require
    Haptics = require("expo-haptics");
} catch (e) {
    Haptics = null;
}

// Web-only: react-dom's createPortal, used instead of RN's <Modal> on web —
// see the long comment above the render below for why.
let createPortal = null;
if (Platform.OS === "web") {
    try {
        // eslint-disable-next-line global-require
        createPortal = require("react-dom").createPortal;
    } catch (e) {
        createPortal = null;
    }
}

// Lightweight, non-blocking toast to replace blocking alert()/Alert.alert calls.
// Usage:
//   const toast = useToast();
//   toast.success("Saved"); toast.error("Could not save"); toast.info("...")
//
// Rendered above any open modal so an error/success toast is never hidden
// behind an open form — plain view-tree overlays render *behind* a Modal's
// separate layer. The two platforms need different fixes:
//  - Native: RN's own <Modal> presents in a genuinely separate native
//    layer/window, so wrapping the toast in one is enough. Safe because the
//    toast has pointerEvents="none" (never intercepts touches).
//  - Web: react-native-web's <Modal> is a DOM portal with its own focus
//    trap (ModalFocusTrap.js) that forces keyboard focus onto whichever
//    modal is topmost the instant it mounts — which would yank focus out
//    of a field a user is actively typing into just because a toast
//    appeared. A raw react-dom portal straight to document.body renders
//    above everything (same stacking mechanism react-native-web's own
//    Modal uses internally) without touching focus at all.

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
            if (Haptics && Haptics.notificationAsync) {
                const feedback =
                    kind === "success"
                        ? Haptics.NotificationFeedbackType.Success
                        : kind === "error"
                          ? Haptics.NotificationFeedbackType.Error
                          : null;
                if (feedback) Haptics.notificationAsync(feedback).catch(() => {});
            }
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

    const overlay = toast ? (
        <Animated.View
            pointerEvents="none"
            style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
        >
            <View style={[styles.toast, { backgroundColor: k.bg }, shadow.raised]}>
                <Ionicons name={k.icon} size={18} color={k.color} />
                <Text selectable style={[styles.text, { color: k.color }]}>
                    {toast.message}
                </Text>
            </View>
        </Animated.View>
    ) : null;

    let overlayNode = null;
    if (toast) {
        if (Platform.OS === "web") {
            overlayNode =
                createPortal && typeof document !== "undefined"
                    ? createPortal(overlay, document.body)
                    : overlay; // fallback: still visible, just not layer-guaranteed
        } else {
            overlayNode = (
                <Modal transparent animationType="none" visible statusBarTranslucent>
                    {overlay}
                </Modal>
            );
        }
    }

    return (
        <ToastContext.Provider value={api}>
            {children}
            {overlayNode}
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    wrap: {
        // "fixed" on web: this View is portaled straight to document.body
        // (see createPortal above), so it needs to pin to the viewport the
        // same way react-native-web's own Modal overlays do, not scroll
        // with the page. Native keeps "absolute" — it's the only layer
        // inside the platform Modal wrapping it either way.
        position: Platform.OS === "web" ? "fixed" : "absolute",
        left: space.lg,
        right: space.lg,
        bottom: 90,
        alignItems: "center",
        // Defensive: react-native-web's own Modal portals stack purely by
        // DOM insertion order (no z-index anywhere in its source) — this
        // toast mounts later than an already-open form modal in the normal
        // flow, so order alone would place it on top, but a zIndex removes
        // any dependency on that ordering (e.g. a toast already showing
        // when a modal opens after it).
        zIndex: 1000,
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
