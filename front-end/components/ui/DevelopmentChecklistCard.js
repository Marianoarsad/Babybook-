import React, { useId, useMemo, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { bandLabel, summarizeChecklist } from "../../utils/milestoneChecklist";
import { shortDate } from "../../utils/dates";
import { DashboardSurface as Surface, DashboardControl as Control } from "./ConsultationsAppointmentsCard";
import RecordIcon from "./RecordIcon";
import AnimatedReveal from "./AnimatedReveal";

function CategoryIcon({ kind }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const material = colors.developmentChecklist.categoryArt[kind];
    const id = "development-art-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const paths = {
        social: "M18 30C14 27 4 20 4 12 4 4 14 3 18 10 22 3 32 4 32 12 32 20 22 27 18 30Z",
        language: "M18 5C9 5 4 10 4 17c0 4 2 7 5 9l-3 6 9-4h3c9 0 14-5 14-12S26 5 18 5Z",
        cognitive: "M18 3C11 3 7 8 7 14c0 6 5 8 6 13h10c1-5 6-7 6-13 0-6-4-11-11-11Z M14 30h8l-2 3h-4Z",
        motor: "m17 12 5 3 5-2 M17 12l-5 7-6 1 M17 12l4 10 7 4 M21 22l-7 3-3 8",
    };
    return <View accessible={false} pointerEvents="none" style={{ width: 40, height: 40, borderRadius: 15,
        alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.rowShadow }}>
        <Surface colors={material.surface} highlight={p.highlight} radius={15} />
        <Svg aria-hidden width={30} height={30} viewBox="0 0 36 36" style={{ position: "relative" }}>
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="0.8" y2="1">
                {material.art.map((color, index) => <Stop key={color} offset={index / 2} stopColor={color} />)}
            </LinearGradient></Defs>
            {kind === "motor" ? <>
                <Circle cx="21" cy="6" r="4" fill={`url(#${id})`} />
                <Path d={paths[kind]} fill="none" stroke={`url(#${id})`} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </> : <Path d={paths[kind]} fill={`url(#${id})`} stroke={material.art[2]} strokeWidth="1.2" strokeLinejoin="round" />}
            {kind === "language" ? [11, 18, 25].map(x => <Circle key={x} cx={x} cy="16" r="1.7" fill={material.art[2]} />) : null}
            {kind !== "motor" ? <Path d={kind === "social" ? "M8 13c0-5 5-6 7-3" : kind === "language" ? "M8 14c1-4 5-6 10-6" : "M11 13c0-4 3-6 6-6"}
                fill="none" stroke={p.reflection} strokeWidth="2" strokeLinecap="round" opacity="0.75" /> : null}
        </Svg>
    </View>;
}

function ChecklistRow({ entry, busy, expanded, onToggle, styles }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard, d = colors.developmentChecklist;
    const { item, record, completed } = entry;
    const pending = !!record?._pending || busy === item.title;
    return <Control testID={`development-item-${item.id}`} material={{ surface: p.row }} radius={18}
        style={[styles.row, pending && { opacity: 0.65 }]} onPress={() => onToggle(item.title)}
        disabled={pending} {...(Platform.OS === "web" ? { tabIndex: expanded ? 0 : -1 } : {})}
        accessibilityRole="checkbox" accessibilityLabel={item.title}
        aria-checked={completed} aria-busy={pending}
        accessibilityState={{ checked: completed, disabled: pending, busy: pending }}>
        {completed && record.photoUrl ? <Image accessible={false} source={{ uri: record.photoUrl }} style={styles.photo} /> : null}
        <View style={styles.rowText}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {completed && record.date ? <>
                {record.ageAchieved ? <Text style={styles.ageAchieved}>{record.ageAchieved}</Text> : null}
                <Text style={styles.recorded}>{`Recorded ${shortDate(record.date)}`}</Text>
            </> : null}
        </View>
        <View accessible={false} pointerEvents="none" style={[styles.checkbox, {
            borderColor: completed ? "transparent" : p.azure, boxShadow: completed ? p.rowShadow : undefined,
        }]}>
            <Surface colors={completed ? d.checked : p.control} highlight={p.highlight} radius={8} />
            {completed ? <Ionicons accessible={false} name="checkmark" size={23} color={d.onChecked} /> : null}
        </View>
    </Control>;
}

export function DevelopmentCategory({ category, busy, onToggle, styles }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const [expanded, setExpanded] = useState(true);
    const id = "development-category-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <View testID={`development-category-${category.key}`} style={styles.category}>
        <Surface colors={p.panel} highlight={p.highlight} radius={24} />
        <Control material={{ surface: p.control }} appearance="text" radius={20} style={styles.categoryHeader}
            onPress={() => setExpanded(value => !value)} accessibilityRole="button"
            accessibilityLabel={`${category.label}, ${category.completed} of ${category.total} recorded`}
            accessibilityState={{ expanded }} aria-expanded={expanded} aria-controls={id}>
            <CategoryIcon kind={category.key} />
            <Text style={styles.categoryTitle}>{category.label}</Text>
            <Text style={styles.categoryCount}>{`${category.completed} of ${category.total}`}</Text>
            <View accessible={false} pointerEvents="none" style={styles.chevron}>
                <Surface colors={p.control} highlight={p.highlight} radius={18} />
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color={p.azure} />
            </View>
        </Control>
        <View nativeID={id} aria-hidden={!expanded}>
            <AnimatedReveal expanded={expanded} contentStyle={styles.categoryItems}>
                {category.entries.map(entry => <ChecklistRow key={entry.item.id} entry={entry} busy={busy}
                    expanded={expanded} onToggle={onToggle} styles={styles} />)}
            </AnimatedReveal>
        </View>
    </View>;
}

export default function DevelopmentChecklistCard({ items, milestones, selectedBand, subtitle, busy, onToggle, onChooseAge }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard, d = colors.developmentChecklist;
    const { width, fontScale } = useWindowDimensions();
    const compact = width < 370 || fontScale > 1.2;
    const styles = useMemo(() => makeStyles(p, d, compact), [p, d, compact]);
    const summary = useMemo(() => summarizeChecklist(items, milestones), [items, milestones]);
    const trigger = useRef(null);
    return <View testID="development-checklist" style={styles.panel}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}>
            <RecordIcon category="milestone" size={compact ? 44 : 52} />
            <View style={styles.headerText}>
                <Text accessibilityRole="header" style={styles.title}>Development Checklist</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
        </View>
        <Control ref={trigger} testID="development-age" material={{ surface: p.row }} radius={22} style={styles.ageSelector}
            onPress={() => trigger.current?.measureInWindow((x, y, width, height) => onChooseAge({ x, y, width, height }))}
            accessibilityRole="button" accessibilityLabel={`Age ${bandLabel(selectedBand)}. Choose a different age`}>
            <View style={styles.calendar}>
                <Surface colors={p.control} highlight={p.highlight} radius={15} />
                <Image accessible={false} source={require("../../assets/navbar/calendar-blue.png")} style={{ width: 30, height: 30 }} resizeMode="contain" />
            </View>
            <Text style={styles.ageLabel}>{bandLabel(selectedBand)}</Text>
            <Ionicons name="chevron-down" size={20} color={p.azure} />
        </Control>
        <View style={styles.progress}>
            <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>{`${summary.completed} of ${summary.total} recorded`}</Text>
                <Text style={styles.progressLabel}>{`${summary.percentage}% complete`}</Text>
            </View>
            <View testID="development-progress" accessibilityRole="progressbar"
                aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.completed}
                aria-valuetext={`${summary.completed} of ${summary.total} recorded, ${summary.percentage}% complete`}
                accessibilityLabel="Checklist completion" accessibilityValue={{ min: 0, max: summary.total, now: summary.completed,
                    text: `${summary.completed} of ${summary.total} recorded, ${summary.percentage}% complete` }} style={styles.track}>
                <View style={{ height: "100%", width: `${summary.percentage}%`, borderRadius: 8 }}>
                    <Surface colors={d.checked} highlight={p.highlight} radius={8} />
                </View>
            </View>
        </View>
        {summary.categories.map(category => <DevelopmentCategory key={category.key} category={category}
            busy={busy} onToggle={onToggle} styles={styles} />)}
        <View style={styles.guidance}>
            <Surface colors={d.guidance} highlight={p.highlight} radius={22} />
            <View style={styles.informationIcon}>
                <Surface colors={p.control} highlight={p.highlight} radius={14} />
                <Ionicons accessible={false} name="information" size={26} color={p.azure} />
            </View>
            <Text style={styles.guidanceText}>Children develop at their own pace, and reaching something later than this list says is common. Nothing here is a test or a score — if anything about your child's development worries you, your health worker is the person to ask.</Text>
        </View>
        <Text style={styles.source}>Based on the CDC's “Learn the Signs. Act Early.” developmental milestones (2022 revision), which describe what most children can do by each age. This is a shortened list — see cdc.gov for the full one, and note that health centers and day care centers in the Philippines use their own ECCD Checklist. The list ends at 5 years because published milestone checklists do.</Text>
    </View>;
}

const makeStyles = (p, d, compact) => StyleSheet.create({
    panel: { padding: compact ? 12 : 16, marginBottom: 20, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
    headerText: { flex: 1, minWidth: 0, gap: 5 },
    title: { fontSize: compact ? 19 : 21, lineHeight: compact ? 25 : 28, fontWeight: "700", color: p.text },
    subtitle: { fontSize: 12, lineHeight: 18, color: p.secondary },
    ageSelector: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingHorizontal: 12, paddingVertical: 8 },
    calendar: { width: 40, height: 40, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    ageLabel: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "700", color: p.text },
    progress: { marginTop: 18, marginBottom: 22, gap: 9 },
    progressLabels: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
    progressLabel: { fontSize: 12, lineHeight: 18, color: p.secondary },
    track: { height: 12, borderRadius: 8, overflow: "hidden", backgroundColor: d.track, boxShadow: `inset 1px 2px 4px ${d.trackShade}` },
    category: { marginBottom: 16, borderRadius: 24, backgroundColor: p.panel[0], boxShadow: p.rowShadow, overflow: "visible" },
    categoryHeader: { flexDirection: "row", alignItems: "center", gap: compact ? 7 : 9, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 },
    categoryTitle: { flex: 1, minWidth: 0, fontSize: compact ? 13 : 14, lineHeight: 19, fontWeight: "700", color: p.text },
    categoryCount: { fontSize: 11, lineHeight: 17, color: p.secondary, flexShrink: 0 },
    chevron: { width: 30, height: 36, justifyContent: "center", alignItems: "center" },
    // Space belongs to every header; gutters also protect shadows during the height reveal.
    categoryItems: { paddingTop: 12, paddingHorizontal: 10, paddingBottom: 14, gap: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 54 },
    rowText: { flex: 1, minWidth: 0, gap: 3 },
    itemTitle: { fontSize: 14, lineHeight: 20, color: p.text },
    ageAchieved: { fontSize: 12, lineHeight: 17, color: p.secondary },
    recorded: { fontSize: 11, lineHeight: 16, color: d.recorded },
    photo: { width: compact ? 42 : 48, height: compact ? 42 : 48, borderRadius: 12, flexShrink: 0 },
    checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, flexShrink: 0, justifyContent: "center", alignItems: "center" },
    guidance: { flexDirection: "row", gap: 12, padding: 14, marginTop: 4, borderRadius: 22, boxShadow: p.rowShadow },
    informationIcon: { width: 36, height: 40, justifyContent: "center", alignItems: "center" },
    guidanceText: { flex: 1, fontSize: 12, lineHeight: 18, color: p.secondary },
    source: { fontSize: 11, lineHeight: 17, marginTop: 18, color: p.secondary },
});
