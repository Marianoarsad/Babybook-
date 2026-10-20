import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { radius, space, type } from "../../theme";
import { shortDate, todayLocal } from "../../utils/dates";
import { ageInDays } from "../../utils/whoGrowth";
import { solidFoodStats } from "../../utils/feedingStats";
import Gradient from "../ui/Gradient";
import { NeumorphicMeasurements } from "../ui/GrowthVisuals";

export function growthMeasurements(rows, dob) {
    return (rows || []).map((r) => {
        const date = r.date_recorded ? String(r.date_recorded).slice(0, 10) : null;
        if (!date) return null;
        const number = (field) => r[field] != null && r[field] !== "" ? Number(r[field]) : null;
        return { id: r.id, date, day: ageInDays(dob, date), weight: number("weight"),
            height: number("height"), head_circumference: number("head_circumference"),
            measured_at: r.measured_at || null, notes: r.notes || null, raw: r };
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || Number(b.id || 0) - Number(a.id || 0));
}

export function LatestMeasurementsSummary({ measurement, plain = false, appearance }) {
    const { colors, scheme } = useTheme();
    const { t } = useLanguage();
    const styles = useMemo(() => makeStyles(colors, scheme, plain), [colors, scheme, plain]);
    if (appearance === "neumorphic" && !plain) return <NeumorphicMeasurements measurement={measurement} />;
    const Container = plain ? View : Gradient;
    return <Container colors={plain ? undefined : [colors.primaryDark, colors.primary]} style={styles.metricsHeaderBox}>
        <View style={styles.metricsHeaderHeading}>
            <Text style={styles.metricsHeaderTitle} numberOfLines={1}>{t("growthLatestMeasurements")}</Text>
            {measurement ? <Text selectable style={styles.metricsHeaderDate} numberOfLines={1}>{shortDate(measurement.date)}</Text> : null}
        </View>
        <View style={styles.metricsHeaderRow}>
            {[
                { field: "weight", label: "growthWeight", unit: "kg" },
                { field: "height", label: "growthHeight", unit: "cm" },
                { field: "head_circumference", label: "growthHeadCirc", unit: "cm" },
            ].map((col, i) => <React.Fragment key={col.field}>
                {i > 0 ? <View style={styles.metricsHeaderDivider} /> : null}
                <View style={styles.metricsHeaderCol}>
                    <Text style={styles.metricsHeaderLabel} numberOfLines={1}>{t(col.label)}</Text>
                    {measurement?.[col.field] != null ? <>
                        <Text selectable style={styles.metricsHeaderValue} numberOfLines={1}>{measurement[col.field]}</Text>
                        <Text style={styles.metricsHeaderUnit} numberOfLines={1}>{col.unit}</Text>
                    </> : <Text style={styles.metricsHeaderEmpty}>{measurement ? "—" : t("growthNoRecordYet")}</Text>}
                </View>
            </React.Fragment>)}
        </View>
    </Container>;
}

export function SolidFoodsSummary({ solids, dob, readOnly = false }) {
    const { colors, scheme } = useTheme();
    const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
    const stats = solidFoodStats(solids, todayLocal().slice(0, 7));
    const days = stats.first && dob ? ageInDays(dob, stats.first.date) : null;
    const months = days != null ? Math.round(days / 30.4375) : null;
    return <>
        <View style={styles.tileRow}>
            {[[stats.distinct, "Different foods"], [stats.newThisMonth, "New this month"], [stats.reactions.length, "With a reaction"]]
                .map(([value, label]) => <View key={label} style={styles.tile}>
                    <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
                    <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
                </View>)}
        </View>
        {!solids.length ? <Text style={styles.tileFootnote}>No solid foods recorded.</Text> : null}
        {stats.first ? <Text style={styles.tileFootnote}>
            First solid food was {stats.first.foodIntroduced} on {shortDate(stats.first.date)}
            {months != null ? `, at ${months} month${months === 1 ? "" : "s"} old` : ""}
        </Text> : null}
        {stats.reactions.length ? <View style={styles.reactionBlock}>
            <Text style={styles.blockHeading}>Foods with a recorded reaction</Text>
            {stats.reactions.map((e, i) => {
                const severe = e.reactionSeverity === "severe";
                const severity = severe ? "Severe" : e.reactionSeverity === "mild" ? "Mild" : "Reaction recorded";
                return <View key={`${e.id || "food"}-${i}`} style={[styles.reactionRow,
                    { backgroundColor: severe ? colors.dangerBg : colors.warningBg }]}>
                    <Ionicons name={severe ? "alert-circle" : "alert-circle-outline"} size={16} color={severe ? colors.danger : colors.warning} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.reactionFood}>{e.foodIntroduced || "Solid food"}</Text>
                        <Text style={styles.reactionMeta}>{severity}{e.reaction ? ` · ${e.reaction}` : ""}</Text>
                        <Text style={[styles.reactionMeta, { marginTop: space.xs }]}>{shortDate(e.date)}</Text>
                    </View>
                </View>;
            })}
            <Text style={styles.reactionNote}>{readOnly
                ? "These are recorded food reactions, not confirmed allergies."
                : "Recorded here only. If any of these becomes a known allergy, add it to the child's profile so it shows on their health ID."}</Text>
        </View> : null}
    </>;
}

const makeStyles = (colors, scheme, plain = false) => {
    const foreground = plain ? colors.text : scheme === "dark" ? colors.background : colors.onPrimary;
    return StyleSheet.create({
        metricsHeaderBox: { borderRadius: radius.md, borderCurve: "continuous", padding: 16, marginBottom: 16,
            ...(plain ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline } : {}) },
        metricsHeaderHeading: { flexDirection: "column", alignItems: "flex-start", gap: 2, paddingBottom: space.xs, marginBottom: space.sm },
        metricsHeaderTitle: { ...type.bodyStrong, color: foreground, flexShrink: 1, textTransform: "capitalize" },
        metricsHeaderDate: { ...type.caption, fontFamily: "PublicSans_400Regular", fontWeight: "400", color: foreground, opacity: 0.95, textAlign: "left" },
        metricsHeaderRow: { flexDirection: "row", alignItems: "stretch" },
        metricsHeaderCol: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: "center" },
        metricsHeaderLabel: { ...type.subheading, color: foreground, opacity: 0.95 },
        metricsHeaderValue: { ...type.heading, color: foreground, marginTop: 4, fontVariant: ["tabular-nums"] },
        metricsHeaderUnit: { ...type.caption, color: foreground, opacity: 0.95 },
        metricsHeaderEmpty: { ...type.caption, color: foreground, opacity: 0.95, textAlign: "center", marginTop: space.sm },
        metricsHeaderDivider: { width: 1, height: "100%", backgroundColor: foreground + "33" },
        tileRow: { flexDirection: "row", gap: space.sm },
        tile: { flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingVertical: space.md, paddingHorizontal: space.xs,
            borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.hairline },
        tileValue: { ...type.heading, color: colors.text },
        tileLabel: { ...type.caption, color: colors.textMuted, textAlign: "center" },
        tileFootnote: { ...type.caption, color: colors.textMuted, marginTop: space.sm },
        reactionBlock: { marginTop: space.lg },
        blockHeading: { ...type.subheading, color: colors.textMuted, marginBottom: space.sm },
        reactionRow: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md,
            borderRadius: radius.md, borderCurve: "continuous", marginBottom: space.sm },
        reactionFood: { ...type.label, color: colors.text },
        reactionMeta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
        reactionNote: { ...type.caption, color: colors.textMuted },
    });
};
