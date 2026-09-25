import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { radius, space } from "../../theme";
import { shouldClaimHorizontalSwipe, shouldOpenSwipe } from "../../utils/swipeMath";

const ACTION_WIDTH = 72;
const FOREGROUND_OVERLAP = 12;

export default function SwipeActionRow({ open, onOpen, onClose, onPress, actions, label, children }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
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
        Animated.spring(translateX, {
            toValue: isOpen ? -revealDistance : 0,
            speed: 18,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    }, [revealDistance, translateX]);

    useEffect(() => settle(open), [open, settle]);

    const pan = useMemo(
        () => PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gesture) =>
                shouldClaimHorizontalSwipe(gesture.dx, gesture.dy),
            onPanResponderGrant: () => {
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
        [revealDistance, settle, translateX],
    );

    const runAction = (name) => actions.find((action) => action.key === name)?.onPress();
    const actionOpacity = translateX.interpolate({
        inputRange: [-24, -6, 0],
        outputRange: [1, 0, 0],
        extrapolate: "clamp",
    });

    return (
        <View style={styles.row} accessible={!open} accessibilityRole="button"
            accessibilityLabel={label} accessibilityHint="Swipe left for actions"
            onAccessibilityTap={open ? onClose : onPress}
            accessibilityActions={actions.map((action) => ({ name: action.key, label: action.label }))}
            onAccessibilityAction={(event) => runAction(event.nativeEvent.actionName)}
            {...pan.panHandlers}>
            <Animated.View style={[styles.actions, { width: revealWidth, opacity: actionOpacity }]}
                pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open}
                importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
                {actions.map((action) => (
                    <TouchableOpacity key={action.key}
                        style={[styles.action, action.key === "update" && styles.leadingAction,
                            action.kind === "delete" && styles.deleteAction]}
                        onPress={action.onPress} accessibilityRole="button"
                        accessibilityLabel={action.label + " " + label}>
                        <Ionicons name={action.icon} size={19} color={action.color} />
                    </TouchableOpacity>
                ))}
            </Animated.View>
            <Animated.View style={[styles.foreground, { transform: [{ translateX }] }]}>
                <TouchableOpacity activeOpacity={1} disabled={!open && !onPress}
                    onPress={open ? onClose : onPress} accessible={false}>
                    {children}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: {
        position: "relative",
        overflow: "hidden",
        borderRadius: radius.lg,
        borderCurve: "continuous",
        marginBottom: space.sm,
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
        borderRadius: radius.lg,
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
