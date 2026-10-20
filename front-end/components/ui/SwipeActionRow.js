import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { space, recordItemStyle } from "../../theme";
import { shouldClaimHorizontalSwipe, shouldOpenSwipe } from "../../utils/swipeMath";

import useSoftPress from "./useSoftPress";
import useReducedMotion from "./useReducedMotion";

const ACTION_WIDTH = 72;
const FOREGROUND_OVERLAP = 12;

export default function SwipeActionRow({ open, onOpen, onClose, onPress, actions, label, children, style, foregroundStyle, pressScale = 1 }) {
    const { colors } = useTheme();
    const reduced = useReducedMotion();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { respond, transform } = useSoftPress(pressScale);
    const revealWidth = actions.length * ACTION_WIDTH;
    const revealDistance = revealWidth - FOREGROUND_OVERLAP;
    const translateX = useRef(new Animated.Value(0)).current;
    const dragStart = useRef(0);
    const openRef = useRef(open);
    const onOpenRef = useRef(onOpen);
    const onCloseRef = useRef(onClose);

    openRef.current = open;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;

    const settle = useCallback((isOpen) => {
        if (reduced !== false) { translateX.stopAnimation(); translateX.setValue(isOpen ? -revealDistance : 0); return; }
        Animated.spring(translateX, {
            toValue: isOpen ? -revealDistance : 0,
            speed: 18,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    }, [revealDistance, translateX, reduced]);

    useEffect(() => settle(open), [open, settle]);

    const pan = useMemo(
        () => PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gesture) =>
                shouldClaimHorizontalSwipe(gesture.dx, gesture.dy),
            onPanResponderGrant: () => {
                respond(false);
                translateX.stopAnimation((value) => { dragStart.current = value; });
            },
            onPanResponderMove: (_event, gesture) => {
                translateX.setValue(Math.max(-revealDistance, Math.min(0, dragStart.current + gesture.dx)));
            },
            onPanResponderRelease: (_event, gesture) => {
                const nextOpen = shouldOpenSwipe({
                    dx: gesture.dx,
                    wasOpen: openRef.current,
                    revealWidth: revealDistance,
                });
                settle(nextOpen);
                (nextOpen ? onOpenRef.current : onCloseRef.current)();
            },
            onPanResponderTerminate: () => settle(openRef.current),
        }),
        [revealDistance, settle, translateX, respond],
    );

    const runAction = (name) => actions.find((action) => action.key === name)?.onPress();
    const actionOpacity = translateX.interpolate({
        inputRange: [-24, -6, 0],
        outputRange: [1, 0, 0],
        extrapolate: "clamp",
    });

    const content = (
        <View style={styles.row} accessible={Platform.OS !== "web" && !open} accessibilityRole={Platform.OS === "web" ? undefined : "button"}
            accessibilityLabel={Platform.OS === "web" ? undefined : label} accessibilityHint="Swipe left for actions"

            onAccessibilityTap={open ? onClose : onPress}
            accessibilityActions={actions.map((action) => ({ name: action.key, label: action.label }))}
            onAccessibilityAction={(event) => runAction(event.nativeEvent.actionName)}
            {...pan.panHandlers}>
            <Animated.View style={[styles.actions, { width: revealWidth, opacity: actionOpacity }]}
                pointerEvents={open ? "auto" : "none"} aria-hidden={!open} accessibilityElementsHidden={!open}
                importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
                {actions.map((action) => (
                    <TouchableOpacity key={action.key}
                        style={[styles.action, action.key === "update" && styles.leadingAction,
                            action.kind === "delete" && styles.deleteAction]}
                        onPress={action.onPress} accessibilityRole="button" tabIndex={open ? 0 : -1}
                        accessibilityLabel={action.label + " " + label}>
                        <Ionicons name={action.icon} size={19} color={action.color} />
                    </TouchableOpacity>
                ))}
            </Animated.View>
            <Animated.View style={[styles.foreground, foregroundStyle, { transform: [{ translateX }] }]}>
                <TouchableOpacity activeOpacity={1} onPressIn={() => respond(true)} onPressOut={() => respond(false)} disabled={!open && !onPress}
                    onPress={open ? onClose : onPress} accessible={Platform.OS === "web"}
                    accessibilityRole={Platform.OS === "web" ? "button" : undefined}
                    accessibilityLabel={Platform.OS === "web" ? label : undefined}
                    accessibilityHint={Platform.OS === "web" ? "Press Left Arrow for actions" : undefined}>
                    {children}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
    return <Animated.View style={[styles.shadow, style, { transform }]}>{content}</Animated.View>;
}

const makeStyles = (colors) => StyleSheet.create({
    shadow: recordItemStyle(colors),
    row: {
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        borderCurve: "continuous",
        marginBottom: 0,
    },
    actions: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    foreground: {
        position: "relative",
        zIndex: 1,
        width: "100%",
        overflow: "hidden",
        borderRadius: 24,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
    },
    action: {
        width: ACTION_WIDTH,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    leadingAction: { paddingLeft: space.lg },
    deleteAction: { backgroundColor: colors.danger },
});
