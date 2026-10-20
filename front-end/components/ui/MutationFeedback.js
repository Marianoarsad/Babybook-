import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, radius, shadow, space, type } from "../../theme";
import { api } from "../../utils/api";
import store from "../../utils/recordStore.cjs";
import { useRecordOperations } from "../../utils/useRecords";
import { useToast } from "./Toast";

export default function MutationFeedback({ profiles, top }) {
    const operations = useRecordOperations();
    const { colors } = useTheme();
    const toast = useToast();
    const lock = useRef(false);
    const [checking, setChecking] = useState(false);
    const [selectedKey, setSelectedKey] = useState(null);
    const op = operations.find((item) => item.key === selectedKey) || operations.find((item) => item.status !== "saving") || operations[0];
    if (!op) return null;
    const name = profiles.find((profile) => String(profile.id) === op.child)?.nickname
        || profiles.find((profile) => String(profile.id) === op.child)?.name || "Baby profile";
    const run = async (action) => {
        if (lock.current) return;
        lock.current = true; setChecking(true);
        try {
            const confirmed = action === "check" ? await api.checkMutation(op) : (await api.retryMutation(op), true);
            if (op.epoch !== store.getEpoch()) return;
            if (confirmed) toast.success("Change confirmed");
            else toast.info("Not confirmed yet. You can check again or retry the same change.");
        } catch (error) { if (op.epoch === store.getEpoch()) toast.error(error.message || "Could not confirm the change"); }
        finally { lock.current = false; setChecking(false); }
    };
    const action = (label, onPress) => <Pressable onPress={onPress} disabled={checking}
        accessibilityRole="button" accessibilityLabel={`${label} ${op.label || "change"} for ${name}`}
        accessibilityState={{ disabled: checking, busy: checking }}
        style={{ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm }}>
        <Text style={{ ...type.label, color: colors.primary }}>{label}</Text>
    </Pressable>;
    return <View style={{ position: "absolute", top, left: space.md, right: space.md, zIndex: 90,
        backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, ...shadow.raised }}>
        <Text accessibilityLiveRegion="polite" style={{ ...type.caption, color: colors.text }}>
            {name} · {op.label || "Change"} · {op.status === "saving" ? "Saving…" : op.status === "uncertain" ? "Needs confirmation" : "Not saved"}
            {operations.length > 1 ? ` (${operations.length} changes)` : ""}
        </Text>
        {op.status !== "saving" ? <>
            <Text style={{ ...type.caption, color: colors.textSecondary }}>
                {op.resource === "medication-doses" ? "This is a recording error, not an instruction to repeat a dose." : op.message}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {action("Check", () => run("check"))}
                {action("Retry", () => run("retry"))}
                {op.status === "failed" ? action("Dismiss", () => store.dismiss(op)) : null}
            </View>
        </> : null}
        {operations.length > 1 ? action("Next change", () => setSelectedKey(
            operations[(operations.findIndex((item) => item.key === op.key) + 1) % operations.length].key,
        )) : null}
    </View>;
}
