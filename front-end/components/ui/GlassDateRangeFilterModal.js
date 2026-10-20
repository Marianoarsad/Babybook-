import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppModal from "./AppModal";
import Gradient from "./Gradient";
import GlassLighting from "./GlassLighting";
import { DateWheelPicker } from "./DateField";
import useReducedMotion from "./useReducedMotion";
import useSoftPress from "./useSoftPress";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MIN_TOUCH, type } from "../../theme";
import { dateEndpointBounds, monthLabel, shiftMonthClamped, shortDate, todayLocal, weekOfMonth } from "../../utils/dates";
import { commitFilterDate, dateFilterDraft, dateFilterError, selectFilterPeriod } from "../../utils/dateFilter";

const CALENDARS = { boy: require("../../assets/navbar/calendar-blue.png"), girl: require("../../assets/navbar/calendar-pink.png") };
const PRESETS = ["week", "month", "year"];
const MONTHS = Array.from({ length: 12 }, (_, month) => new Date(2026, month, 1).toLocaleDateString("en-US", { month: "short" }));

export default function GlassDateRangeFilterModal({ visible, title, subtitle, value, minimumDate, availableDates = [],
    years, resolvePreset, onApply, onClose, blurTarget }) {
    const { colors, scheme } = useTheme();
    const { t } = useLanguage();
    const material = colors.dateFilterGlass;
    const styles = useMemo(() => makeStyles(material), [material]);
    const { width, height, fontScale } = useWindowDimensions();
    const insets = useSafeAreaInsets(), reduced = useReducedMotion();
    const today = todayLocal();
    const minDate = minimumDate && minimumDate <= today ? minimumDate : null;
    const earliestMonth = minDate?.slice(0, 7) || availableDates.slice().sort()[0]?.slice(0, 7) || today.slice(0, 7);
    const latestMonth = today.slice(0, 7);
    const yearOptions = years || Array.from({ length: Math.max(1, Number(today.slice(0, 4)) - Number(earliestMonth.slice(0, 4)) + 1) }, (_, i) => Number(earliestMonth.slice(0, 4)) + i);
    const [draft, setDraft] = useState(() => dateFilterDraft(value));
    const [presented, setPresented] = useState(visible);
    const [picker, setPicker] = useState(null), [dateEndpoint, setDateEndpoint] = useState(null);
    const [visibleMonth, setVisibleMonth] = useState(today);
    const transition = useRef(new Animated.Value(0)).current;
    const wasOpen = useRef(false), applied = useRef(false);
    const latestValue = useRef(value); latestValue.current = value;
    useEffect(() => {
        transition.stopAnimation();
        if (visible) {
            if (!wasOpen.current) {
                setDraft(dateFilterDraft(latestValue.current)); setPicker(null); setDateEndpoint(null); applied.current = false;
            }
            setPresented(true);
        }
        wasOpen.current = visible;
        if (reduced) { transition.setValue(visible ? 1 : 0); if (!visible) setPresented(false); }
        else Animated.timing(transition, { toValue: visible ? 1 : 0, duration: 220,
            easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => {
                if (finished && !visible) setPresented(false);
            });
        return () => transition.stopAnimation();
    }, [visible, reduced, transition]);

    const error = dateFilterError(draft, minDate, today, yearOptions);
    const close = () => { if (visible) onClose(); };
    const back = () => { if (!visible) return; if (picker) setPicker(null); else close(); };
    const choosePreset = key => {
        setDraft(old => resolvePreset(key, old, { today, minimumDate: minDate, availableDates, years: yearOptions, earliestMonth }));
        setPicker(null);
    };
    const openPeriod = endpoint => {
        const month = draft.preset === "week" ? draft.weekRange.month : draft.monthRange?.[endpoint] || today.slice(0, 7);
        setVisibleMonth(`${month}-01`); setPicker(endpoint);
    };
    const selectPeriod = selected => {
        setDraft(old => selectFilterPeriod(old, picker, selected, visibleMonth.slice(0, 7), minDate, today));
        setPicker(null);
    };
    const bounds = dateEndpointBounds(draft.dateRange, dateEndpoint, minDate, today);
    const selectedMonth = visibleMonth.slice(0, 7), visibleYear = Number(visibleMonth.slice(0, 4));
    const availableWeeks = new Set(availableDates.filter(date => date.startsWith(selectedMonth)).map(weekOfMonth));
    const small = width < 350;
    const stackPreset = fontScale > 1.2 && width < 420;
    const supportsBlur = Platform.OS === "web" ? Boolean(globalThis.CSS?.supports?.("backdrop-filter", "blur(1px)") || globalThis.CSS?.supports?.("-webkit-backdrop-filter", "blur(1px)"))
        : Platform.OS === "ios" || (Platform.OS === "android" && Number(Platform.Version) >= 31 && !!blurTarget);

    if (!presented) return null;
    return <AppModal visible={presented} transparent animationType="none" presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={back}>
        <View style={styles.overlay}>
            {supportsBlur ? Platform.OS === "web" ? <Animated.View testID="date-filter-real-blur" pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.webBlur, { opacity: transition }]} />
                : <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: transition }]}><BlurView blurTarget={blurTarget}
                    blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined} blurReductionFactor={2} intensity={80}
                    tint={Platform.OS === "android" ? "default" : scheme === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} style={StyleSheet.absoluteFillObject} /></Animated.View> : null}
            <Animated.View testID="date-filter-overlay" style={[StyleSheet.absoluteFillObject, { backgroundColor: material.overlay, opacity: transition }]}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityLabel="Dismiss date filter" accessibilityRole="button" />
            </Animated.View>
            <View pointerEvents="box-none" style={[styles.frame, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
                <Animated.View testID="glass-date-filter" accessibilityViewIsModal
                    style={[styles.panel, { opacity: transition, maxHeight: Math.max(160, height - insets.top - insets.bottom - 32),
                        transform: [{ scale: transition.interpolate({ inputRange: [0, 1], outputRange: reduced ? [1, 1] : [0.96, 1] }) }] }]}>
                    <View pointerEvents="none" accessible={false} style={styles.material}>
                        {!supportsBlur ? <View testID="date-filter-blur-fallback" style={[StyleSheet.absoluteFillObject, { backgroundColor: material.fallback }]} /> : null}
                        <Gradient colors={material.panel} style={StyleSheet.absoluteFillObject} />
                        <GlassLighting material={material} radius={28} panel />
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, small && styles.contentSmall]} showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Gradient colors={material.icon} style={styles.headerIcon}>
                                <GlassLighting material={material} radius={24} />
                                <AnalyticsGlyph material={material} />
                            </Gradient>
                            <View style={styles.headerText}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
                            <GlassControl circular icon="close" label="Close date filter" onPress={close} styles={styles} material={material} />
                        </View>
                        {!picker ? <>
                            <Text style={styles.sectionTitle}>{t("growthQuickActions")}</Text>
                            <View style={styles.presets}>{PRESETS.map(key => <GlassControl key={key} testID={`date-preset-${key}`}
                                icon="calendar-outline" label={t({ week: "growthWeekShort", month: "growthMonthShort", year: "growthYearShort" }[key])}
                                toggle selected={draft.preset === key} onPress={() => choosePreset(key)} styles={styles} material={material} vertical={stackPreset} style={styles.preset} />)}</View>
                            <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
                            <View><Text style={styles.sectionTitle}>{t("dateFilterCustomRange")}</Text><Text style={styles.subtitle}>{t("dateFilterCustomHelp")}</Text></View>
                            {["from", "to"].map(endpoint => <View key={endpoint} style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>{t(endpoint === "from" ? "growthStartingDate" : "growthEndingDate")}</Text>
                                <GlassControl testID={`date-field-${endpoint}`} icon="calendar-outline" trailing="chevron-down"
                                    label={shortDate(draft.dateRange?.[endpoint]) || "Select date"}
                                    accessibilityLabel={`${endpoint === "from" ? "Starting" : "Ending"} date: ${shortDate(draft.dateRange?.[endpoint]) || "Select date"}`}
                                    onPress={() => setDateEndpoint(endpoint)} styles={styles} material={material} field />
                            </View>)}
                            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                        </> : <>
                            <View style={styles.pickerModes}>
                                <GlassControl label={t("dateFilterExactDate")} onPress={() => { setDateEndpoint(picker); setPicker(null); }} styles={styles} material={material} style={styles.modeButton} />
                                <GlassControl label={t({week:"growthWeekShort",month:"growthMonthShort",year:"growthYearShort"}[draft.preset])} selected toggle onPress={() => {}} styles={styles} material={material} style={styles.modeButton} />
                            </View>
                            <Text accessibilityRole="header" style={styles.sectionTitle}>{picker === "from" ? "Starting" : "Ending"} {draft.preset}</Text>
                            <Text style={styles.subtitle}>Choose a {draft.preset}.</Text>
                            {draft.preset !== "year" ? <View style={styles.pickerHeader}>
                                <GlassControl circular icon="chevron-back" label="Previous period" disabled={draft.preset === "week" ? selectedMonth <= earliestMonth : visibleYear <= Number(earliestMonth.slice(0, 4))}
                                    onPress={() => setVisibleMonth(shiftMonthClamped(visibleMonth, draft.preset === "week" ? -1 : -12))} styles={styles} material={material} />
                                <Text style={styles.fieldLabel}>{draft.preset === "week" ? monthLabel(visibleMonth) : visibleYear}</Text>
                                <GlassControl circular icon="chevron-forward" label="Next period" disabled={draft.preset === "week" ? selectedMonth >= latestMonth : visibleYear >= Number(today.slice(0, 4))}
                                    onPress={() => setVisibleMonth(shiftMonthClamped(visibleMonth, draft.preset === "week" ? 1 : 12))} styles={styles} material={material} />
                            </View> : null}
                            <View style={styles.grid}>{(draft.preset === "week" ? [1, 2, 3, 4] : draft.preset === "month" ? MONTHS.map((_, i) => i + 1) : yearOptions).map(option => {
                                const range = draft[`${draft.preset}Range`];
                                const candidate = draft.preset === "month" ? `${visibleYear}-${String(option).padStart(2, "0")}` : option;
                                const sameMonth = draft.preset !== "week" || range.month === selectedMonth;
                                const conflicts = sameMonth && (picker === "from" ? range.to != null && candidate > range.to : range.from != null && candidate < range.from);
                                const disabled = conflicts || (draft.preset === "week" && !availableWeeks.has(option))
                                    || (draft.preset === "month" && (candidate < earliestMonth || candidate > latestMonth));
                                const label = draft.preset === "week" ? t("growthWeekNumber").replace("{week}", option) : draft.preset === "month" ? MONTHS[option - 1] : String(option);
                                return <View key={option} style={[styles.gridCell, draft.preset === "week" && styles.weekCell]}><GlassControl label={label} disabled={disabled} toggle
                                    selected={sameMonth && range[picker] === candidate} onPress={() => selectPeriod(option)} styles={styles} material={material} /></View>;
                            })}</View>
                        </>}
                        <View style={styles.footer}>{picker ? <GlassControl label={t("back")} onPress={() => setPicker(null)} styles={styles} material={material} /> : <>
                            <GlassControl label={t("cancel")} onPress={close} styles={styles} material={material} style={styles.footerButton} />
                            <GlassControl label={t("growthDone")} testID="date-filter-done" selected disabled={!!error || !visible}
                                onPress={() => { if (error || applied.current || !visible) return; applied.current = true;
                                    onApply({ dateRange: { ...draft.dateRange }, preset: draft.preset, yearRange: { ...draft.yearRange } }); }}
                                styles={styles} material={material} style={styles.footerButton} />
                        </>}</View>
                    </ScrollView>
                </Animated.View>
            </View>
        </View>
        <DateWheelPicker visible={visible && !!dateEndpoint} value={draft.dateRange?.[dateEndpoint] || today}
            minimumDate={bounds.min || undefined} maximumDate={bounds.max || undefined} availableDates={availableDates}
            headerAccessory={draft.preset ? <View style={styles.pickerModes}>
                <GlassControl label={t("dateFilterExactDate")} selected toggle onPress={() => {}} styles={styles} material={material} style={styles.modeButton} />
                <GlassControl testID="date-picker-period" label={t({week:"growthWeekShort",month:"growthMonthShort",year:"growthYearShort"}[draft.preset])}
                    onPress={() => { openPeriod(dateEndpoint); setDateEndpoint(null); }} styles={styles} material={material} style={styles.modeButton} />
            </View> : undefined}
            accessibilityLabel={t(dateEndpoint === "to" ? "growthEndingDate" : "growthStartingDate")}
            onChange={selected => setDraft(old => commitFilterDate(old, dateEndpoint, selected))} onClose={() => setDateEndpoint(null)} />
    </AppModal>;
}

function GlassControl({ label, accessibilityLabel, icon, trailing, onPress, disabled = false, selected = false, toggle = false, circular, field, vertical, styles, material, style, testID }) {
    const press = useSoftPress(0.98);
    const { mode } = useTheme();
    const [pressed, setPressed] = useState(false);
    const [focused, setFocused] = useState(false);
    const ink = selected ? material.onActive : material.accent;
    const updateFocus = event => { if (Platform.OS === "web") setFocused(Boolean(event.currentTarget?.matches?.(":focus-visible"))); };
    return <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled, selected: toggle ? selected : undefined }} {...(Platform.OS === "web" && toggle ? { "aria-pressed": selected } : {})}
        onPressIn={() => { setPressed(true); press.respond(true); }} onPressOut={() => { setPressed(false); press.respond(false); }}
        onFocus={updateFocus} onKeyDown={updateFocus} onBlur={() => { setFocused(false); setPressed(false); press.respond(false); }}
        style={[styles.control, { boxShadow: pressed ? material.pressedShadow : selected ? material.activeShadow : field ? material.fieldShadow : material.controlShadow }, circular && styles.circular, style, disabled && styles.disabled, focused && styles.focused]}>
        <Animated.View pointerEvents="none" style={[styles.controlFace, { transform: press.transform }]}>
            <Gradient colors={selected ? material.active : field ? material.field : material.control} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} locations={selected ? [0, 0.18, 1] : undefined} style={StyleSheet.absoluteFillObject} />
            <GlassLighting material={material} radius={circular ? 24 : field ? 26 : 24} selected={selected} />
            <View style={[styles.controlContent, vertical && styles.vertical, field && styles.fieldContent, circular && styles.circularContent]}>
                {icon ? field ? <Gradient colors={material.icon} style={styles.calendarIcon}><GlassLighting material={material} radius={12} /><Image source={CALENDARS[mode === "girl" ? "girl" : "boy"]} resizeMode="contain" style={styles.calendarArt} accessible={false} /></Gradient>
                    : <Ionicons name={icon} size={circular ? 24 : 17} color={ink} /> : null}
                {!circular ? <Text style={[styles.controlText, { color: field ? material.text : ink }, field && styles.dateText]}>{label}</Text> : null}
                {trailing ? <Gradient colors={material.control} style={styles.chevron}><GlassLighting material={material} radius={16} /><Ionicons name={trailing} size={18} color={material.secondary} /></Gradient> : null}
            </View>
        </Animated.View>
    </Pressable>;
}

function AnalyticsGlyph({ material: p }) {
    const id = useId().replace(/:/g, "") + "analytics";
    return <Svg width="30" height="30" viewBox="0 0 32 32" accessible={false} aria-hidden={true}>
        <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={p.cyan} /><Stop offset="0.4" stopColor={p.active[0]} /><Stop offset="1" stopColor={p.active[2]} />
        </LinearGradient></Defs>
        {[{ x: 4, y: 20, h: 8 }, { x: 13, y: 12, h: 16 }, { x: 22, y: 4, h: 24 }].map(bar => <React.Fragment key={bar.x}>
            <Rect x={bar.x} y={bar.y} width="6" height={bar.h} rx="3" fill={`url(#${id})`} />
            <Path d={`M${bar.x + 1} ${bar.y + 4} Q${bar.x + 1} ${bar.y + 1} ${bar.x + 4} ${bar.y + 1}`} fill="none" stroke={p.reflection} strokeOpacity="0.7" strokeWidth="1" />
        </React.Fragment>)}
    </Svg>;
}

const makeStyles = p => StyleSheet.create({
    overlay: { flex: 1 }, frame: { flex: 1, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
    panel: { width: "100%", maxWidth: 560, borderRadius: 28, borderWidth: 0, boxShadow: p.panelShadow },
    material: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 27 },
    webBlur: { backdropFilter: "blur(24px) saturate(150%)", WebkitBackdropFilter: "blur(24px) saturate(150%)" },
    content: { padding: 22, gap: 18 }, contentSmall: { padding: 18, gap: 16 },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
    headerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", boxShadow: p.controlShadow, flexShrink: 0 },
    headerText: { flex: 1, minWidth: 0, gap: 5 }, title: { ...type.heading, fontSize: 22, lineHeight: 27, color: p.text },
    subtitle: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary },
    sectionTitle: { ...type.heading, fontSize: 18, lineHeight: 24, color: p.text },
    presets: { flexDirection: "row", gap: 8 }, preset: { flex: 1, minWidth: 0 },
    control: { minHeight: MIN_TOUCH, borderRadius: 24, boxShadow: p.controlShadow, outlineStyle: "none" },
    controlFace: { flexGrow: 1, borderRadius: 24, overflow: "hidden", borderWidth: 0 },
    controlContent: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 10, gap: 6 },
    controlText: { ...type.label, fontSize: 14, lineHeight: 20, flexShrink: 1 }, vertical: { flexDirection: "column", gap: 4, paddingHorizontal: 5 },
    circular: { width: 44, height: 44, flexShrink: 0 }, circularContent: { minHeight: 44, padding: 0, paddingHorizontal: 0, paddingVertical: 0 },
    pickerModes: { flexDirection: "row", gap: 10, paddingVertical: 10 }, modeButton: { flex: 1 },
    divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10 }, line: { flex: 1, height: 1, backgroundColor: p.divider },
    or: { ...type.label, color: p.secondary, fontSize: 12 }, fieldGroup: { gap: 8 }, fieldLabel: { ...type.label, color: p.secondary, fontSize: 14 },
    fieldContent: { minHeight: 58, justifyContent: "flex-start", paddingHorizontal: 12, paddingVertical: 7, gap: 12 },
    dateText: { ...type.body, flex: 1, fontSize: 18, lineHeight: 25 },
    calendarIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", boxShadow: p.controlShadow },
    calendarArt: { width: 30, height: 30 },
    chevron: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", boxShadow: p.controlShadow },
    footer: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 10, paddingBottom: 2 }, footerButton: { minWidth: 104 },
    error: { ...type.caption, color: p.error }, disabled: { opacity: 0.5 }, focused: { outlineStyle: "solid", outlineWidth: 2, outlineColor: p.accent, outlineOffset: 3 },
    pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }, gridCell: { width: "33.333%", padding: 4 }, weekCell: { width: "50%" },
});
