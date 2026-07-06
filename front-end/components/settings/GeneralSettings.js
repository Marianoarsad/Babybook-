import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { storage } from "../../utils/storageAdapter";
import { notificationsAvailable } from "../../utils/notifications";
import { useTheme } from "../../context/ThemeContext";
import { space } from "../../theme";

export const LEAD_TIME_KEY = "bb_default_reminder_lead";
export const LEAD_TIME_OPTIONS = [
    { key: "0", label: "Same day" },
    { key: "1", label: "1 day before" },
    { key: "3", label: "3 days before" },
    { key: "7", label: "1 week before" },
];

// General app-level settings (distinct from Theme/Language, which have their
// own menu destinations). Currently: default reminder lead time for
// calendar/appointment notifications.
export default function GeneralSettings() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <ScrollView style={styles.container}>
            <SectionContainerCard
                title="Reminder Notifications"
                subtitle={
                    notificationsAvailable()
                        ? "Default lead time for appointment and event reminders"
                        : "Notifications aren't available on this platform, but this preference still applies where supported"
                }
            >
                {LEAD_TIME_OPTIONS.map((opt) => {
                    const on = leadDays === opt.key;
                    return (
                        <TouchableOpacity
                            key={opt.key}
                            onPress={() => choose(opt.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            style={[styles.option, on && styles.optionActive]}
                        >
                            <View style={[styles.radio, on && styles.radioActive]}>
                                {on ? <View style={styles.radioDot} /> : null}
                            </View>
                            <Text style={[styles.optionLabel, on && styles.optionLabelActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </SectionContainerCard>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        option: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginBottom: 8,
        },
        optionActive: { borderColor: colors.primary, backgroundColor: colors.softGreen },
        radio: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: "#D6D3D1",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
        },
        radioActive: { borderColor: colors.primary },
        radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
        optionLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
        optionLabelActive: { color: colors.primary },
    });
