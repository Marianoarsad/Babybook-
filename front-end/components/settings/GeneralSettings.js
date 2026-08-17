import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionContainerCard, RadioRow } from "../common/Cards";
import { storage } from "../../utils/storageAdapter";
import { notificationsAvailable } from "../../utils/notifications";
import { useTheme } from "../../context/ThemeContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { space } from "../../theme";

export const LEAD_TIME_KEY = "bb_default_reminder_lead";
export const LEAD_TIME_OPTIONS = [
    { key: "0", label: "Same day", icon: "flash-outline" },
    { key: "1", label: "1 day before", icon: "today-outline" },
    { key: "3", label: "3 days before", icon: "calendar-outline" },
    { key: "7", label: "1 week before", icon: "calendar-clear-outline" },
];

// General app-level settings (distinct from Theme/Language, which have their
// own menu destinations). Currently: default reminder lead time for
// calendar/appointment notifications.
export default function GeneralSettings() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const [leadDays, setLeadDays] = useState("1");

    useEffect(() => {
        (async () => {
            const saved = await storage.getItem(LEAD_TIME_KEY);
            if (saved) setLeadDays(saved);
        })();
    }, []);

    const choose = async (key) => {
        setLeadDays(key);
        await storage.setItem(LEAD_TIME_KEY, key);
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <SectionContainerCard
                title="Reminder Notifications"
                subtitle={
                    notificationsAvailable()
                        ? "Default lead time for appointment and event reminders"
                        : "Notifications aren't available on this platform, but this preference still applies where supported"
                }
            >
                {LEAD_TIME_OPTIONS.map((opt) => (
                    <RadioRow
                        key={opt.key}
                        label={opt.label}
                        selected={leadDays === opt.key}
                        onPress={() => choose(opt.key)}
                        icon={<Ionicons name={opt.icon} size={18} color={colors.recCheckup.on} />}
                        iconBg={colors.recCheckup.bg}
                    />
                ))}
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content so the bottom clearance scrolls with it.
        content: { padding: space.lg },
    });
