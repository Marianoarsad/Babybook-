import { NutritionControl, NutritionControlIcon } from "./NutritionVisuals";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassDateRangeFilterModal from "./GlassDateRangeFilterModal";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MIN_TOUCH, space, type } from "../../theme";
import { numericDateRange, todayLocal, toLocalISO } from "../../utils/dates";
import { nutritionPreset } from "../../utils/dateFilter";

export function nutritionDateView(saved, minimumDate, referenceDate = todayLocal()) {
    const today = String(referenceDate).slice(0, 10);
    const year = Number(today.slice(0, 4));
    if (saved?.dateRange?.from && saved?.dateRange?.to) {
        return {
            dateRange: saved.dateRange,
            preset: ["week", "month", "year"].includes(saved.preset) ? saved.preset : null,
            yearRange: saved.yearRange || { from: year, to: year },
        };
    }
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - 6);
    const rollingFrom = toLocalISO(start);
    const from = minimumDate && minimumDate > rollingFrom && minimumDate <= today
        ? minimumDate
        : rollingFrom;
    return {
        dateRange: { from, to: today },
        preset: null,
        yearRange: { from: year, to: year },
    };
}

export default function NutritionDateFilter({ value, onChange, minimumDate, availableDates = [], style, blurTarget }) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [open, setOpen] = useState(false);
    const label = value.preset
        ? t({ week: "dateFilterWeekly", month: "dateFilterMonthly", year: "dateFilterYearly" }[value.preset])
        : numericDateRange(value.dateRange.from, value.dateRange.to);
    return <>
        <NutritionControl style={[styles.trigger, style]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Filter nutrition dates, ${label}`}>
            <NutritionControlIcon calendar size={20} />
            <Text style={styles.triggerText} numberOfLines={1}>{label}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </NutritionControl>
        <GlassDateRangeFilterModal visible={open} title={t("dateFilterNutritionTitle")}
            subtitle={t("dateFilterNutritionHelp")}
            value={value} minimumDate={minimumDate} availableDates={availableDates} resolvePreset={nutritionPreset} blurTarget={blurTarget}
            onClose={() => setOpen(false)} onApply={next => { onChange(next); setOpen(false); }} />
    </>;
}

const makeStyles = colors => StyleSheet.create({
    trigger: { minHeight: MIN_TOUCH, minWidth: 0, maxWidth: "100%", flexShrink: 1, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.sm, borderRadius: 24, backgroundColor: "transparent" },
    triggerText: { ...type.label, color: colors.text, flexShrink: 1 },
});
