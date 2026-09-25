import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Modal from "./AppModal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { expandedSheetHeight, recordSheetHeight, useScreenPadTop } from "../../utils/responsive";
import { useScroll } from "../../context/ScrollContext";
import { MIN_TOUCH, radius, shadow, space, type } from "../../theme";
import { canDeleteRecord, deleteRecordAndClose, headerActionIcon } from "./recordFormActions.cjs";
import KeyboardAvoider from "./KeyboardAvoider";
import useBottomSheetMotion from "./useBottomSheetMotion";

const RecordFormContext = createContext(false);
export const useRecordForm = () => useContext(RecordFormContext);

export function RecordFormGroup({ children, style }) {
    const { colors } = useTheme();
    return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.xl,
        borderCurve: "continuous", padding: space.lg, gap: space.sm, marginBottom: space.lg }, style]}>{children}</View>;
}

// The original label/control are retained, including their validation and copy.
export function RecordFormRow({ label, children, stacked = false, divider = true }) {
    const { colors } = useTheme();
    const [width, setWidth] = useState(0);
    const vertical = stacked || (width > 0 && width < 280);
    return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{
        flexDirection: vertical ? "column" : "row", alignItems: vertical ? "stretch" : "center",
        gap: space.sm, paddingVertical: space.sm, borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.hairline, marginBottom: space.xs,
    }}>
        <View style={vertical ? undefined : { flex: 1, minWidth: 0 }}>
            {React.isValidElement(label) ? React.cloneElement(label, { style: [label.props.style,
                { ...type.label, color: colors.text, marginBottom: 0, flexShrink: 1 }] }) : label}
        </View>
        <View style={vertical ? undefined : { flex: 1.35, minWidth: 0 }}>
            {React.isValidElement(children) ? React.cloneElement(children, { style: [children.props.style, {
                backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, borderCurve: "continuous",
                marginBottom: 0, minHeight: stacked ? 96 : 52, paddingHorizontal: space.md,
            }] }) : children}
        </View>
    </View>;
}

export function RecordFormScreen({ children, onSubmit, submitLabel = "Save Changes", busy = false }) {
    const { colors } = useTheme();
    const { scrollProps, tabBarHeight } = useScroll();
    const padTop = useScreenPadTop();
    const submitLock = useRef(false);
    const submit = async () => {
        if (busy || submitLock.current) return;
        submitLock.current = true;
        try { await onSubmit(); } finally { submitLock.current = false; }
    };
    return <KeyboardAvoider style={{ position: "absolute", top: 0, right: 0, bottom: tabBarHeight, left: 0, zIndex: 1 }}>
        <RecordFormContext.Provider value>
            <Animated.ScrollView style={{ flex: 1 }} {...scrollProps} keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: space.lg, paddingTop: padTop, paddingBottom: space.xl }}>
                {children}
                <Pressable onPress={submit} disabled={busy} accessibilityRole="button"
                    accessibilityLabel={submitLabel} accessibilityState={{ disabled: busy, busy }}
                    style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.accentStrong,
                        alignItems: "center", justifyContent: "center", padding: space.md, opacity: busy || pressed ? 0.65 : 1 })}>
                    <Text style={{ ...type.label, color: colors.onAccent }}>{submitLabel}</Text>
                </Pressable>
            </Animated.ScrollView>
        </RecordFormContext.Provider>
    </KeyboardAvoider>;
}

export function DeleteConfirmation({ visible, inline = false, title, message, cancelLabel = "Cancel",
    deleteLabel = "Delete", busy = false, error = "", onCancel, onConfirm }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const confirmRef = useRef(null);
    useEffect(() => {
        if (visible) {
            Keyboard.dismiss();
            confirmRef.current?.focus?.();
            AccessibilityInfo.announceForAccessibility?.(`${title}. ${message}`);
        }
    }, [visible, title, message]);
    if (!visible) return null;
    const content = <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end",
        padding: space.lg, paddingBottom: Math.max(insets.bottom, space.lg), backgroundColor: colors.text + "66" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onCancel()} accessibilityRole="button" accessibilityLabel={cancelLabel} />
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.xl,
            borderCurve: "continuous", padding: space.xl, gap: space.md, width: "100%", maxWidth: 460,
            alignSelf: "center", ...shadow.raised }}>
            <Text accessibilityRole="header" style={{ ...type.heading, color: colors.text, textAlign: "center" }}>{title}</Text>
            <Text style={{ ...type.body, color: colors.textSecondary, textAlign: "center" }}>{message}</Text>
            {error ? <Text accessibilityRole="alert" style={{ ...type.caption, color: colors.danger }}>{error}</Text> : null}
            <Pressable ref={confirmRef} onPress={onConfirm} disabled={busy} accessibilityRole="button"
                accessibilityLabel={deleteLabel} accessibilityState={{ disabled: busy, busy }}
                style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
                    alignItems: "center", justifyContent: "center", opacity: busy || pressed ? 0.65 : 1, padding: space.md })}>
                {(<Text style={{ ...type.body, color: colors.danger }}>{deleteLabel}</Text>)}
            </Pressable>
            <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel={cancelLabel}
                style={{ minHeight: MIN_TOUCH, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ ...type.label, color: colors.textSecondary }}>{cancelLabel}</Text>
            </Pressable>
        </View>
    </View>;
    return inline ? content : <Modal visible transparent animationType="fade" onRequestClose={() => !busy && onCancel()}>{content}</Modal>;
}

export default function RecordFormSheet({ visible, title, children, onClose, onSubmit, cancelLabel = "Cancel",
    submitLabel = "Save", busy = false, error = "", record = null, onDelete, deleteLabel = "Delete", deleteTitle = "Delete record?",
    deleteMessage = "Delete this record? This cannot be undone.", dismissible = true }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const { height, fontScale } = useWindowDimensions();
    const sheetHeight = recordSheetHeight(height, fontScale, insets.top, insets.bottom);
    const expandedHeight = expandedSheetHeight(height, sheetHeight, insets.top);
    const cancelIcon = headerActionIcon(cancelLabel, "cancel", t("cancel"));
    const saveIcon = headerActionIcon(submitLabel, "save", t("save"));
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const deleteLock = useRef(false);
    const deleteScope = useRef({ visible, id: record?.id, version: 0 });
    if (deleteScope.current.visible !== visible || deleteScope.current.id !== record?.id) {
        deleteScope.current = { visible, id: record?.id, version: deleteScope.current.version + 1 };
        deleteLock.current = false;
    }
    const submitLock = useRef(false);
    const deleteButton = useRef(null);
    useEffect(() => { setDeleting(false); if (!visible) { setConfirming(false); setDeleteError(""); } }, [visible, record?.id]);
    const blocked = busy || deleting;
    const canDismiss = dismissible && !blocked && !confirming;
    const motion = useBottomSheetMotion({ visible, collapsedHeight: sheetHeight, expandedHeight, onClose, gestureEnabled: canDismiss });
    const styles = useMemo(() => StyleSheet.create({
        root: { flex: 1, justifyContent: "flex-end", paddingTop: Math.max(insets.top, space.md) },
        sheet: { maxHeight: "100%", flexShrink: 1, minHeight: 0, width: "100%",
            backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
            borderCurve: "continuous", overflow: "hidden", ...shadow.raised },
        header: { padding: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, gap: space.sm },
        heading: { ...type.heading, fontSize: type.heading.fontSize * 1.3, lineHeight: type.heading.lineHeight * 1.3,
            color: colors.text, textAlign: "center", flex: 1.5, minWidth: 0 },
        actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
        action: { minHeight: MIN_TOUCH * 1.3, minWidth: MIN_TOUCH * 1.3, maxWidth: "32%", paddingHorizontal: space.md * 1.3, paddingVertical: space.sm * 1.3,
            borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", flexShrink: 1 },
        actionText: { ...type.label, fontSize: type.label.fontSize * 1.3, lineHeight: type.label.lineHeight * 1.3, color: colors.text, textAlign: "center" },
        actionIcon: { width: MIN_TOUCH * 1.3, height: MIN_TOUCH * 1.3, paddingHorizontal: 0, paddingVertical: 0, flexShrink: 0 },
        content: { padding: space.lg, paddingBottom: space.xl + insets.bottom },
    }), [colors, insets.top, insets.bottom]);
    const submit = async () => {
        if (blocked || confirming || submitLock.current) return;
        submitLock.current = true;
        try { await onSubmit(); } finally { submitLock.current = false; }
    };
    const cancelDelete = () => { if (!deleteLock.current) { setConfirming(false); setDeleteError(""); deleteButton.current?.focus?.(); } };
    const confirmDelete = async () => {
        if (deleteLock.current || busy || !onDelete) return;
        deleteLock.current = true;
        setDeleting(true);
        setDeleteError("");
        const scopeVersion = deleteScope.current.version;
        const isCurrent = () => deleteScope.current.visible && deleteScope.current.version === scopeVersion;
        try {
            const success = await deleteRecordAndClose(onDelete, onClose, isCurrent);
            if (!success && isCurrent()) setDeleteError("Could not delete the record. Please try again.");
        } catch (e) {
            if (isCurrent()) setDeleteError(e.message || "Could not delete the record. Please try again.");
        } finally { if (deleteScope.current.version === scopeVersion) { deleteLock.current = false; setDeleting(false); } }
    };
    return <Modal visible={motion.presented} transparent animationType="none" onShow={motion.startOpening}
        onRequestClose={() => { if (confirming) cancelDelete(); else if (canDismiss) motion.dismiss(); }}>
        <KeyboardAvoider>
            <View style={styles.root}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.text + "66", opacity: motion.shade }]} />
                <Pressable style={StyleSheet.absoluteFill} onPress={() => canDismiss && motion.dismiss()}
                    accessibilityRole="button" accessibilityLabel={cancelLabel} disabled={!canDismiss} />
                <Animated.View style={[styles.sheet, { height: expandedHeight, transform: [{ translateY: motion.offset }] }]}
                    accessibilityViewIsModal onAccessibilityEscape={() => canDismiss && motion.dismiss()}>
                    <RecordFormContext.Provider value>
                        <View style={{ flex: 1, minHeight: 0 }} pointerEvents={confirming ? "none" : "auto"}
                            accessibilityElementsHidden={confirming} importantForAccessibility={confirming ? "no-hide-descendants" : "auto"}>
                            <View {...motion.pan.panHandlers} style={[styles.header, { touchAction: "none" }]}>
                                <View style={styles.actions}>
                                    <Pressable onPress={() => !blocked && motion.dismiss()} disabled={blocked} style={[styles.action, cancelIcon && styles.actionIcon]}
                                        accessibilityRole="button" accessibilityLabel={cancelLabel} accessibilityState={{ disabled: blocked }}>
                                        {cancelIcon ? <Ionicons name={cancelIcon} size={31} color={colors.text} /> : <Text style={styles.actionText}>{cancelLabel}</Text>}
                                    </Pressable>
                                    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
                                    <Pressable onPress={submit} disabled={blocked} accessibilityRole="button" accessibilityLabel={submitLabel}
                                        accessibilityState={{ disabled: blocked, busy }} style={[styles.action, saveIcon && styles.actionIcon, { opacity: blocked ? 0.6 : 1 }]}>
                                        {(saveIcon ? <Ionicons name={saveIcon} size={31} color={colors.text} /> : <Text style={styles.actionText}>{submitLabel}</Text>)}
                                    </Pressable>
                                </View>
                                {error ? <Text accessibilityRole="alert" style={{ ...type.caption, color: colors.danger }}>{error}</Text> : null}
                            </View>
                            <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                                {children}
                                {canDeleteRecord(record, onDelete) ? <Pressable ref={deleteButton} onPress={() => { Keyboard.dismiss(); setConfirming(true); }} disabled={blocked}
                                    accessibilityRole="button" accessibilityLabel={deleteLabel} accessibilityState={{ disabled: blocked }}
                                    style={{ minHeight: 52, padding: space.md, paddingHorizontal: space.xl, borderRadius: radius.pill,
                                        backgroundColor: colors.surface, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: space.lg }}>
                                    <Text style={{ ...type.body, color: colors.danger }}>{deleteLabel}</Text>
                                </Pressable> : null}
                            </ScrollView>
                        </View>
                        <DeleteConfirmation inline visible={confirming} title={deleteTitle} message={deleteMessage} cancelLabel={cancelLabel}
                            deleteLabel={deleteLabel} busy={deleting} error={deleteError} onCancel={cancelDelete} onConfirm={confirmDelete} />
                    </RecordFormContext.Provider>
                </Animated.View>
            </View>
        </KeyboardAvoider>
    </Modal>;
}
