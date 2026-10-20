import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { APPOINTMENT_STATUS_LABELS } from "../../utils/appointmentSummary";
import { shortDate, shortTime } from "../../utils/dates";
import AnimatedReveal from "./AnimatedReveal";
import Gradient from "./Gradient";
import AllRecordsIcon from "./AllRecordsIcon";
import { AppointmentsSkeleton, SkeletonBlock } from "./Skeleton";
import useReducedMotion from "./useReducedMotion";
import useSoftPress from "./useSoftPress";

const FILTERS = [{ key: "all", label: "All" }, ...["completed", "upcoming", "overdue"].map(key => ({ key, label: APPOINTMENT_STATUS_LABELS[key] }))];
const EMPTY = {
    all: "No consultations or appointments recorded yet.", completed: "No completed consultations yet.",
    upcoming: "No upcoming appointments.", overdue: "No overdue appointments.",
};

function Surface({ colors, highlight, radius = 22 }) {
    return <Gradient accessible={false} pointerEvents="none" colors={colors}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, boxShadow: "inset 1px 2px 3px " + highlight }]} />;
}

function Control({ active = false, material, radius = 22, faceSize, appearance, style, children, ...props }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const reduced = useReducedMotion(), { respond, transform } = useSoftPress();
    const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
    const [focused, setFocused] = useState(false), [pressed, setPressed] = useState(false);
    useLayoutEffect(() => {
        selection.stopAnimation();
        if (reduced !== false) selection.setValue(active ? 1 : 0);
        else Animated.timing(selection, { toValue: active ? 1 : 0, duration: 200, easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
        return () => selection.stopAnimation();
    }, [active, reduced, selection]);
    const focus = e => setFocused(Platform.OS === "web" && Boolean(e.currentTarget?.matches?.(":focus-visible")));
    const press = down => { setPressed(down); respond(down); };
    return <Pressable {...props} aria-pressed={props.accessibilityState?.selected}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
        onPressIn={() => press(true)} onPressOut={() => press(false)}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius }, style, Platform.OS === "web" && {
            outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.azure }]}>
        {appearance !== "text" ? <Animated.View pointerEvents="none" style={[faceSize ? {
            position: "absolute", width: faceSize, height: faceSize, top: "50%", left: "50%", marginTop: -faceSize / 2, marginLeft: -faceSize / 2,
        } : StyleSheet.absoluteFillObject, { borderRadius: radius, transform,
            backgroundColor: material.surface[0], boxShadow: pressed ? p.pressedShadow : active ? p.activeShadow : p.rowShadow }]}>
            <Surface colors={material.surface} highlight={p.highlight} radius={radius} />
            {material.active ? <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: selection }]}>
                <Surface colors={material.active} highlight={p.highlight} radius={radius} />
            </Animated.View> : null}
        </Animated.View> : null}
        {children}
    </Pressable>;
}

// Status artwork is shared by the metric filters and their record rows, not record-category icons.
export function AppointmentStatusIcon({ kind, size = 44, showBackground = true }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const material = p[kind] || p.all;
    const id = "appointment-art-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const calendar = !["completed", "upcoming", "overdue"].includes(kind);
    return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: showBackground ? p.rowShadow : undefined }}>
        {showBackground ? <Surface colors={material.surface} highlight={p.highlight} radius={size / 2} /> : null}
        {kind === "all" || kind === "other" ? <Image accessible={false} source={require("../../assets/navbar/calendar-blue.png")}
            resizeMode="contain" style={{ width: size * 0.73, height: size * 0.73 }} /> :
        <Svg aria-hidden pointerEvents="none" width={size * 0.73} height={size * 0.73}
            viewBox="0 0 36 36" style={{ position: "relative" }}>
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                {material.art.map((color, index) => <Stop key={color} offset={index / 2} stopColor={color} />)}
            </LinearGradient></Defs>
            {calendar ? <>
                <Rect x="6" y="8" width="25" height="26" rx="6" fill={material.art[2]} opacity="0.2" />
                <Rect x="5" y="6" width="25" height="26" rx="6" fill={`url(#${id})`} />
                <Rect x="8" y="14" width="19" height="14" rx="2" fill={p.reflection} opacity="0.95" />
                <Path d="M12 4v6 M23 4v6" stroke={material.art[1]} strokeWidth="4" strokeLinecap="round" />
                {[12, 18, 24].flatMap(x => [18, 24].map(y => <Rect key={`${x}-${y}`} x={x - 1.5} y={y - 1.5}
                    width="3" height="3" rx="0.7" fill={material.art[1]} />))}
                <Path d="M8 11q0-2 3-2h12" fill="none" stroke={p.reflection} strokeWidth="1.2" opacity="0.7" />
            </> : kind === "upcoming" ? <>
                <Circle cx="18" cy="20" r="13" fill={material.art[2]} opacity="0.18" />
                <Circle cx="18" cy="18" r="13" fill={`url(#${id})`} />
                <Circle cx="18" cy="18" r="9.7" fill={p.reflection} opacity="0.95" />
                <Path d="M18 11v7l5 3" stroke={material.art[2]} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <Path d="M8 13q3-7 10-7" fill="none" stroke={p.reflection} strokeWidth="1.3" opacity="0.8" />
            </> : <>
                <Circle cx="18" cy="20" r="13" fill={material.art[2]} opacity="0.22" />
                <Circle cx="18" cy="17" r="13" fill={`url(#${id})`} />
                {kind === "completed" ? <Path d="m11 17 5 5 10-11" fill="none" stroke={p.reflection}
                    strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" /> :
                    <Path d="M18 10v9 M18 24v.1" stroke={p.reflection} strokeWidth="3.7" strokeLinecap="round" />}
                <Path d="M8 13q2-7 10-7" fill="none" stroke={p.reflection} strokeWidth="1.3" opacity="0.75" />
            </>}
        </Svg>}
    </View>;
}

export function AppointmentSummaryMetrics({ counts, selectedFilter, onSelect }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { fontScale } = useWindowDimensions();
    const [width, setWidth] = useState(0);
    const columns = width >= 600 * fontScale ? 4 : width > 0 && (width - 10) / 2 < 100 * fontScale ? 1 : 2;
    const compact = width > 0 && width / columns < 148 * fontScale;
    const groups = [];
    for (let i = 0; i < FILTERS.length; i += columns) groups.push(FILTERS.slice(i, i + columns));
    return <View testID="appointment-metrics" style={styles.metrics} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {groups.map((group, i) => <View key={i} style={styles.metricRow}>
            {group.map(filter => <Control key={filter.key} testID={`appointment-filter-${filter.key}`} material={p[filter.key]}
                active={selectedFilter === filter.key} style={[styles.metric, compact && styles.compactMetric]} onPress={() => onSelect(filter.key)}
                accessibilityRole="button" accessibilityLabel={`${filter.label}, ${counts[filter.key]} ${counts[filter.key] === 1 ? "appointment" : "appointments"}. Status follows the Calendar checklist.`}
                accessibilityState={{ selected: selectedFilter === filter.key }}>
                {filter.key === "all" ? <AllRecordsIcon size={40} /> : <AppointmentStatusIcon kind={filter.key} size={40} />}
                <View style={styles.metricBody}>
                    <Text style={[styles.count, compact && styles.centered]}>{counts[filter.key].toLocaleString()}</Text>
                    <Text style={[styles.metricLabel, compact && styles.centered, { color: p[filter.key].ink, fontWeight: selectedFilter === filter.key ? "700" : "500" }]}>{filter.label}</Text>
                </View>
            </Control>)}
        </View>)}
    </View>;
}

function ListTransition({ filter, children, testID = "appointment-list-transition" }) {
    const reduced = useReducedMotion();
    const progress = useRef(new Animated.Value(1)).current;
    const previous = useRef(filter);
    useLayoutEffect(() => {
        progress.stopAnimation();
        const changed = previous.current !== filter;
        previous.current = filter;
        if (reduced !== false || !changed) progress.setValue(1);
        else {
            progress.setValue(0);
            Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad),
                useNativeDriver: Platform.OS !== "web", isInteraction: false }).start();
        }
        return () => progress.stopAnimation();
    }, [filter, reduced, progress]);
    return <Animated.View testID={testID} style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }}>{children}</Animated.View>;
}

export function AppointmentItem({ appointment, onOpen, thumbnailUrl, onOpenAttachment }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const { respond, transform } = useSoftPress();
    const [focused, setFocused] = useState(false), [pressed, setPressed] = useState(false);
    const focus = e => setFocused(Platform.OS === "web" && Boolean(e.currentTarget?.matches?.(":focus-visible")));
    const press = down => { setPressed(down); respond(down); };
    const date = shortDate(appointment.date), time = shortTime(appointment.time);
    return <Animated.View testID={`appointment-item-${appointment.id}`} style={[styles.item, { transform, boxShadow: pressed ? p.pressedShadow : p.rowShadow }]}>
        <Surface colors={p.row} highlight={p.highlight} />
        <Pressable onPress={() => onOpen(appointment)} onPressIn={() => press(true)} onPressOut={() => press(false)}
            onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }} accessibilityRole="button"
            accessibilityLabel={`View ${appointment.title} details. Calendar plan: ${APPOINTMENT_STATUS_LABELS[appointment.calendarStatus]}.${appointment.calendarPending ? " Update pending." : ""} ${[appointment.provider, date, time].filter(Boolean).join(". ")}`}
            style={[styles.itemBody, Platform.OS === "web" && { outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 2, outlineColor: p.azure }]}>
            <AppointmentStatusIcon kind={appointment.calendarStatus} />
            <View style={styles.information}>
                <Text style={styles.itemTitle}>{appointment.title}</Text>
                {appointment.provider ? <Text style={styles.provider}>{appointment.provider}</Text> : null}
                {appointment.notes ? <Text style={styles.notes} numberOfLines={2} ellipsizeMode="tail">“{appointment.notes}”</Text> : null}
                <View style={styles.metadata}>
                    <View style={styles.metaPair}><Ionicons accessible={false} name="calendar-outline" size={13} color={p.secondary} /><Text style={styles.metaText}>{date || "Date not recorded"}</Text></View>
                    {time ? <View style={styles.metaPair}><Ionicons accessible={false} name="time-outline" size={13} color={p.secondary} /><Text style={styles.metaText}>{time}</Text></View> : null}
                </View>
            </View>
            <View accessible={false} pointerEvents="none" style={styles.chevron}>
                <Surface colors={p.control} highlight={p.highlight} radius={17} />
                <Ionicons accessible={false} name="chevron-forward" size={21} color={p.chevron} />
            </View>
        </Pressable>
        {thumbnailUrl ? <Pressable onPress={() => onOpenAttachment(appointment)} accessibilityRole="button"
            accessibilityLabel={`View attached photo for ${appointment.title}`} style={styles.attachment}>
            <Image accessible={false} source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
            <Text style={styles.attachmentText}>View attached photo</Text>
        </Pressable> : null}
    </Animated.View>;
}

export default function ConsultationsAppointmentsCard({ summary, loading, loadFailed, onRetry, onAdd, onOpen, attachmentUrl, onOpenAttachment }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const [selection, setSelection] = useState({ filter: "all", visible: 10 });
    const { filter, visible } = selection;
    const filtered = useMemo(() => filter === "all" ? summary.appointments : summary.appointments.filter(appt => appt.calendarStatus === filter), [summary.appointments, filter]);
    const remaining = Math.max(0, filtered.length - visible);
    return <View testID="consultations-appointments" style={styles.panel}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.header}>
            <AppointmentStatusIcon kind="headerIcon" showBackground={false} />
            <Text style={styles.title}>Consultations &amp; Appointments</Text>
            <Control material={{ surface: p.control }} radius={22} onPress={onAdd} style={styles.add}
                accessibilityRole="button" accessibilityLabel="Add appointment">
                <Ionicons accessible={false} name="add" size={28} color={p.azure} />
            </Control>
        </View>
        <Text style={styles.subtitle}>Manage scheduled wellness checks and specialist visits.</Text>
        {loading ? <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading appointments and Calendar statuses">
            <SkeletonBlock height={95} borderRadius={22} /><AppointmentsSkeleton count={3} />
        </View> : loadFailed ? <View style={styles.empty}>
            <Text style={styles.emptyText}>Appointments and Calendar statuses could not be loaded.</Text>
            <Control material={{ surface: p.control }} style={styles.more} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading appointments">
                <Text style={styles.moreText}>Retry</Text>
            </Control>
        </View> : <>
            <AppointmentSummaryMetrics counts={summary.counts} selectedFilter={filter}
                onSelect={next => setSelection(previous => previous.filter === next ? previous : { filter: next, visible: 10 })} />
            <AnimatedReveal duration={240} contentStyle={styles.listSpace}>
                <ListTransition filter={filter}>
                    <View testID="appointment-results" style={styles.items} accessibilityLiveRegion="polite">
                        {filtered.slice(0, visible).map(appointment => <AppointmentItem key={appointment.id} appointment={appointment}
                            onOpen={onOpen} thumbnailUrl={attachmentUrl?.(appointment)} onOpenAttachment={onOpenAttachment} />)}
                        {!filtered.length ? <View style={styles.empty}>
                            <AppointmentStatusIcon kind={filter} />
                            <Text style={styles.emptyText}>{EMPTY[filter]}</Text>
                        </View> : null}
                        {remaining > 0 ? <Control material={{ surface: p.control }} radius={999} style={styles.more}
                            onPress={() => setSelection(previous => ({ ...previous, visible: previous.visible + 10 }))}
                            accessibilityRole="button" accessibilityLabel={`Show more ${filter === "all" ? "" : filter + " "}appointments, ${remaining} remaining`}>
                            <Ionicons accessible={false} name="chevron-down" size={18} color={p.azure} />
                            <Text style={styles.moreText}>Show more ({remaining.toLocaleString()} remaining)</Text>
                        </Control> : null}
                    </View>
                </ListTransition>
            </AnimatedReveal>
        </>}
    </View>;
}

export { Surface as DashboardSurface, Control as DashboardControl, ListTransition as DashboardListTransition };

const makeStyles = p => StyleSheet.create({
    panel: { padding: 14, borderRadius: 28, backgroundColor: p.panel[0], boxShadow: p.panelShadow, marginBottom: 20, overflow: "visible" },
    header: { flexDirection: "row", alignItems: "center", gap: 10 }, title: { ...type.heading, fontSize: 18, lineHeight: 24, color: p.text, flex: 1, minWidth: 0 },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary, marginTop: 8 },
    add: { width: 44, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    metrics: { marginTop: 16, gap: 10 }, metricRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    metric: { flex: 1, minWidth: 0, minHeight: 94, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    compactMetric: { flexDirection: "column", gap: 6 }, centered: { textAlign: "center" },
    metricBody: { flex: 1, minWidth: 0 }, count: { ...type.heading, fontSize: 23, lineHeight: 29, color: p.text },
    metricLabel: { ...type.caption, fontSize: 13, lineHeight: 19, marginTop: 2 },
    listSpace: { paddingHorizontal: 2, paddingTop: 16, paddingBottom: 10 }, items: { gap: 10 },
    item: { borderRadius: 22, backgroundColor: p.row[0], overflow: "visible" },
    itemBody: { minHeight: 104, borderRadius: 22, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    information: { flex: 1, minWidth: 0 }, itemTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 21, color: p.text },
    provider: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.azure, marginTop: 2 },
    notes: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary, marginTop: 2 },
    metadata: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 5 }, metaPair: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    metaText: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, flexShrink: 1 },
    chevron: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.rowShadow },
    attachment: { minHeight: MIN_TOUCH, marginHorizontal: 12, marginBottom: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 },
    thumbnail: { width: 40, height: 40, borderRadius: 10 }, attachmentText: { ...type.caption, color: p.azure, flexShrink: 1 },
    more: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, gap: 8, marginTop: 4 },
    moreText: { ...type.label, color: p.azure, textAlign: "center", flexShrink: 1 },
    empty: { padding: 18, gap: 12, alignItems: "center" }, emptyText: { ...type.caption, lineHeight: 20, textAlign: "center", color: p.secondary },
    loading: { marginTop: 16, gap: 16 },
});
