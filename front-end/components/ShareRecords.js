import { recordListLayout } from "../theme";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    View,
    Image,
    TextInput,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    AccessibilityInfo,
    Easing,
    Platform,
    useWindowDimensions,
} from "react-native";
import KeyboardAvoider from "./ui/KeyboardAvoider";
import { DashboardSurface as Surface, DashboardControl as Control } from "./ui/ConsultationsAppointmentsCard";
import Avatar from "./ui/Avatar";
import VaccineIcon from "./ui/VaccineIcon";
import GrowthIcon from "./ui/GrowthIcon";
import RecordIcon, { AllergyIcon, HereditaryIcon } from "./ui/RecordIcon";
import { DurationWheel } from "./ui/DateField";
import { Ionicons } from "@expo/vector-icons";
import QrCodeView from "./QrCodeView";
import { formatShareCountdown, RECORD_LABELS, qrPayloadForCode, VISIT_REASON_MAX } from "../utils/shareStore";
import { exportChildRecordsPdf, pdfExportAvailable } from "../utils/exportPdf";
import { api } from "../utils/api";
import { useRecordCache, useScreenRefresh } from "../utils/useRecords";
import { useLanguage } from "../context/LanguageContext";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { useTheme } from "../context/ThemeContext";
import { motion, radius, space, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { EmptyStateCard, ListEntryCard, SectionContainerCard } from "./common/Cards";
import { useRefreshControl } from "./ui/useRefreshControl";
import ShowMore from "./ui/ShowMore";
import AnimatedReveal from "./ui/AnimatedReveal";
import PulseLoader from "./ui/PulseLoader";
import PlanDetail from "./ui/PlanDetail";
import SwipeActionRow from "./ui/SwipeActionRow";
import { DeleteConfirmation } from "./ui/RecordFormSheet";
import { shortDate, toLocalISO } from "../utils/dates";

// Turns a raw user-agent string into a short readable summary, e.g. "Chrome on Android".
function parseUserAgent(ua) {
    if (!ua) return null;
    const browser = /Edg\//.test(ua) ? "Edge"
        : /Chrome\//.test(ua) ? "Chrome"
        : /Firefox\//.test(ua) ? "Firefox"
        : /Safari\//.test(ua) ? "Safari"
        : "Browser";
    const os = /Android/.test(ua) ? "Android"
        : /iPhone|iPad|iOS/.test(ua) ? "iOS"
        : /Windows/.test(ua) ? "Windows"
        : /Mac OS X/.test(ua) ? "Mac"
        : /Linux/.test(ua) ? "Linux"
        : null;
    return os ? `${browser} on ${os}` : browser;
}

function shareDateText(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${time}, ${day}/${month}/${date.getFullYear()}`;
}

function shareGeneratedDateText(value) {
    return shortDate(value) || "Date not recorded";
}

function accessDateParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: "", time: "" };
    return {
        date: toLocalISO(date),
        time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
    };
}

const SHARE_METHODS = [
    { key: "qr", label: "Generate QR" },
    { key: "pdf", label: "Save as PDF" },
];

export function ShareStepCard({ step, title, description, children }) {
    const { colors } = useTheme(), p = colors.shareSurface;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return <View testID={`share-step-${step}`} style={styles.stepCard}>
        <Surface colors={p.panel} highlight={p.highlight} radius={28} />
        <View style={styles.stepHeader}><View accessible={false} style={styles.stepNumber}>
            <Surface colors={p.methodActive} highlight={p.highlight} radius={22} /><Text style={styles.stepNumberText}>{step}</Text>
        </View><View style={styles.stepHeading}><Text accessibilityRole="header" style={styles.stepTitle}>{title}</Text>
            <Text style={styles.stepDescription}>{description}</Text></View></View>
        <View style={styles.stepContent}>{children}</View>
    </View>;
}

function ShareRecordIcon({ kind, profile }) {
    const { colors } = useTheme(), p = colors.shareSurface;
    return <View accessible={false} pointerEvents="none" style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.iconShadow }}>
        <Surface colors={p.tiles[kind]} highlight={p.highlight} radius={24} />
        {kind === "profile" ? <Avatar name={profile.name} uri={profile.avatarUrl} size={42} />
            : kind === "vaccinations" ? <VaccineIcon size={42} showBackground={false} />
            : kind === "growth" ? <GrowthIcon size={42} showBackground={false} />
            : kind === "allergies" ? <View style={{ flexDirection: "row" }}><AllergyIcon size={23} showBackground={false} /><HereditaryIcon size={23} showBackground={false} /></View>
            : kind === "medicalHistory" ? <RecordIcon category="Illness" size={42} showBackground={false} />
            : kind === "milestones" ? <RecordIcon category="milestone" size={40} />
            : <Image accessible={false} resizeMode="contain" source={kind === "checkups" ? require("../assets/navbar/calendar-blue.png") : require("../assets/navbar/nutrition-blue.png")} style={{ width: 38, height: 38 }} />}
    </View>;
}

export default function ShareRecords({ profile, initialSection, initialAccessEntry }) {
    const { t } = useLanguage();
    const toast = useToast();
    const alert = (m) => toast.error(m);
    const { colors } = useTheme();
    const p = colors.shareSurface;
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { width: screenWidth, fontScale = 1 } = useWindowDimensions();
    const [gridWidth, setGridWidth] = useState(0);
    const available = gridWidth || screenWidth - 64;
    const columns = available >= 3 * 244 * fontScale + 24 ? 3 : available >= 2 * 150 * fontScale + 12 ? 2 : 1;
    const tileWidth = Math.floor((available - (columns - 1) * 12 - 1) / columns);
    const compactTiles = tileWidth < 220 * fontScale;
    const qrWidth = Math.max(1, Math.floor(screenWidth - space.xl * 2));
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    const scrollRef = useRef(null);
    const { scrollProps, scrollViewRef } = useScroll(scrollRef);
    const initialSectionReached = useRef(false);
    const sectionTarget = useRef(initialSection);
    if (sectionTarget.current !== initialSection) {
        sectionTarget.current = initialSection;
        initialSectionReached.current = false;
    }
    const allKeys = Object.keys(RECORD_LABELS);
    const [selected, setSelected] = useState(() => new Set(allKeys));
    const [ttl, setTtl] = useState(60);
    const [visitReason, setVisitReason] = useState("");
    const [shareMode, setShareMode] = useState("qr");
    const [noteFocused, setNoteFocused] = useState(false);
    const actionBusy = useRef(null);
    const [shareContentHeight, setShareContentHeight] = useState(0);
    const [shareExpanded, setShareExpanded] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [revokingId, setRevokingId] = useState(null);
    const [revokeCandidate, setRevokeCandidate] = useState(null);
    const [displayedShare, setDisplayedShare] = useState(null);
    const [detailAccessEntry, setDetailAccessEntry] = useState(() => initialAccessEntry
        && String(initialAccessEntry.child_id) === String(profile.id) ? initialAccessEntry : null);
    const [openShareSwipeId, setOpenShareSwipeId] = useState(null);
    const [exportingPdf, setExportingPdf] = useState(false);
    const busy = generating || exportingPdf;
    const shareCache = useRecordCache(profile.id, "shares");
    const logCache = useRecordCache(profile.id, "access-log");
    const [now, setNow] = useState(Date.now);
    const history = useMemo(() => shareCache.rows.map((share) => share.status === "active" && new Date(share.expiration_date).getTime() <= now
        ? { ...share, status: "expired" } : share), [shareCache.rows, now]);
    const accessLog = logCache.rows;
    const currentShare = useMemo(() => displayedShare
        ? history.find((share) => String(share.id) === String(displayedShare.id)) || displayedShare
        : null, [displayedShare, history]);
    const currentShareAccessLog = useMemo(() => currentShare
        ? accessLog.filter((entry) => String(entry.share_id) === String(currentShare.id))
        : [], [accessLog, currentShare]);
    const historyKnown = shareCache.hasFetched || history.length > 0;
    const logKnown = logCache.hasFetched;
    const [historyVisible, setHistoryVisible] = useState(10);
    const [logVisible, setLogVisible] = useState(10);
    const shareFold = useRef(new Animated.Value(0)).current;
    const shareTransition = useRef(0);
    const canExportPdf = pdfExportAvailable();
    const handleRecentSharesLayout = (event) => {
        if (initialSection !== "activeRecentShares" || initialSectionReached.current) return;
        initialSectionReached.current = true;
        const y = Math.max(0, event.nativeEvent.layout.y - padTop);
        requestAnimationFrame(() => {
            if (sectionTarget.current !== "activeRecentShares" || !scrollRef.current) return;
            scrollRef.current?.scrollTo({ y, top: y, animated: true });
            AccessibilityInfo.announceForAccessibility("Active and recent shares");
        });
    };
    const handleAccessLogLayout = (event) => {
        if (initialSection !== "accessLog" || initialSectionReached.current) return;
        initialSectionReached.current = true;
        const y = Math.max(0, event.nativeEvent.layout.y - padTop);
        requestAnimationFrame(() => {
            if (sectionTarget.current !== "accessLog" || !scrollRef.current) return;
            scrollRef.current?.scrollTo({ y, top: y, animated: true });
            AccessibilityInfo.announceForAccessibility("Access log");
        });
    };
    const accessDetailPlan = useMemo(() => {
        if (!detailAccessEntry) return null;
        const accessedAt = accessDateParts(detailAccessEntry.access_date);
        return {
            title: detailAccessEntry.professional_name || "Unnamed professional",
            date: accessedAt.date,
            time: accessedAt.time,
            showTime: !!accessedAt.time,
            categoryLabel: "QR access",
            details: [
                { label: "Action", value: detailAccessEntry.action || "Viewed shared records" },
                { label: "QR code", value: detailAccessEntry.code || "Unavailable" },
                { label: "Device", value: parseUserAgent(detailAccessEntry.user_agent) || "Unavailable" },
                { label: "IP address", value: detailAccessEntry.ip_address || "Unavailable" },
            ],
            showReminder: false,
            showNotes: false,
        };
    }, [detailAccessEntry]);
    const shareDetailPlan = useMemo(() => {
        if (!currentShare) return null;
        return {
            title: currentShare.code || "Unavailable",
            showTitle: currentShare.status !== "active",
            showDate: false,
            showTime: false,
            details: [
                { label: "Status", value: currentShare.status === "active" ? "Active" : currentShare.status === "revoked" ? "Revoked" : "Expired" },
                { label: "Access Expiry", value: shareDateText(currentShare.expiration_date) },
            ],
            showReminder: false,
            showNotes: false,
            deleteLabel: "Revoke Share",
        };
    }, [currentShare]);
    useEffect(() => {
        const clock = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(clock);
    }, []);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => mounted && setReduceMotion(enabled))
            .catch(() => {});
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => {
            mounted = false;
            subscription?.remove?.();
        };
    }, []);
    useEffect(() => {
        shareTransition.current += 1;
        shareFold.stopAnimation();
        shareFold.setValue(0);
        setShareMode("qr");
        actionBusy.current = null;
        setGenerating(false); setExportingPdf(false);
        setSelected(new Set(Object.keys(RECORD_LABELS))); setTtl(60); setVisitReason(""); setNoteFocused(false);
        setShareContentHeight(0);
        setShareExpanded(false);
        setRevokeCandidate(null);
    }, [profile.id, shareFold]);

    // Reveal pulse for the freshly-generated QR — reassures the parent that
    // something just happened, mirrors Skeleton.js's useNativeDriver gating.
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!displayedShare) return;
        const leg = (toValue) =>
            Animated.timing(pulseAnim, {
                toValue,
                duration: motion.pulse.duration / 2,
                easing: Easing.bezier(...motion.pulse.bezier),
                useNativeDriver: Platform.OS !== "web",
            });
        Animated.sequence(
            Array.from({ length: motion.pulse.cycles }).flatMap(() => [
                leg(motion.pulse.scale),
                leg(1),
            ]),
        ).start();
    }, [displayedShare, pulseAnim]);

    const load = useCallback(async (isCurrent) => {
        const outcomes = await Promise.allSettled([
            api.listShares(profile.id, { loading: "nonblocking" }),
            api.accessLog(profile.id, { loading: "nonblocking" }),
        ]);
        if (outcomes[1].status === "fulfilled" && isCurrent()) api.markAccessLogSeen(profile.id, { background: true }).catch(() => {});
        return ["shares", "access-log"].filter((_, index) => outcomes[index].status === "rejected");
    }, [profile.id]);
    const { refreshing: loading, failures, refresh, isActive } = useScreenRefresh(profile.id, load);

    const refreshControl = useRefreshControl(loading, refresh);
    const readStatus = (cache, resource) => {
        const failed = failures.includes(resource) || failures.includes("load");
        const message = failed ? t("screenRefreshFailed") : loading ? t("screenRefreshing")
            : cache.fetchedAt ? t("screenLastChecked").replace("{time}", new Date(cache.fetchedAt).toLocaleTimeString()) : "";
        return message ? <View style={styles.readStatus}>
            <Text style={styles.readStatusText}>{message}</Text>
            {failed ? <TouchableOpacity onPress={refresh} accessibilityRole="button" style={styles.readRetry}>
                <Text style={styles.readRetryText}>{t("retry")}</Text>
            </TouchableOpacity> : null}
        </View> : null;
    };

    const toggle = (key) => {
        if (actionBusy.current) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleGenerate = async () => {
        if (actionBusy.current || !isActive()) return;
        const keys = allKeys.filter((k) => selected.has(k));
        if (keys.length === 0) return alert("Select at least one record category to share.");
        if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1440) return alert("Choose an access duration from 1 minute to 24 hours.");
        if (visitReason.length > VISIT_REASON_MAX) return alert("Keep the visit note to 500 characters.");
        const operation = {}; actionBusy.current = operation;
        setGenerating(true);
        try {
            const share = await api.createShare(profile.id, {
                recordKeys: keys,
                ttlMinutes: ttl,
                visitReason: visitReason.trim(),
            });
            if (actionBusy.current !== operation || !isActive()) return;
            setDisplayedShare(share);
            toast.success("Ready to show the doctor");
            refresh();
        } catch (e) {
            if (actionBusy.current === operation && isActive()) alert(e.message || "Could not generate QR");
        } finally {
            if (actionBusy.current === operation) { actionBusy.current = null; if (isActive()) setGenerating(false); }
        }
    };

    const handleRevoke = async (id) => {
        if (revokingId || !isActive()) return false;
        setRevokingId(id);
        try {
            await api.revokeShare(profile.id, id);
            if (!isActive()) return false;
            if (displayedShare && displayedShare.id === id) setDisplayedShare(null);
            refresh();
            return true;
        } catch (e) {
            if (isActive()) alert(e.message || "Could not revoke");
            return false;
        } finally {
            if (isActive()) setRevokingId(null);
        }
    };

    const confirmRevoke = async () => {
        if (!revokeCandidate) return;
        if (await handleRevoke(revokeCandidate.id)) setRevokeCandidate(null);
    };

    // Prints exactly what step 1 has ticked — the same selection a QR code
    // would carry, so paper and screen can't disagree. The key names in
    // RECORD_LABELS already match the PDF template's CATEGORY_LABELS, so
    // there is no mapping table in between to drift. Untick "Allergies" and
    // the printout has no allergy line either.
    const handleExportPdf = async () => {
        if (actionBusy.current || !isActive() || !canExportPdf) return;
        if (selected.size === 0) return alert("Select at least one record category to share.");
        const operation = {}; actionBusy.current = operation;
        setExportingPdf(true);
        try {
            await exportChildRecordsPdf(profile, { scope: new Set(selected), visitReason: visitReason.trim() });
            if (actionBusy.current === operation && isActive()) toast.success("Records are ready to save as PDF");
        } catch (e) {
            if (actionBusy.current === operation && isActive()) alert(e.message || "Could not export records");
        } finally {
            if (actionBusy.current === operation) { actionBusy.current = null; if (isActive()) setExportingPdf(false); }
        }
    };

    const animateShareFold = (toValue, token, onDone) => {
        shareFold.stopAnimation();
        Animated.timing(shareFold, {
            toValue,
            duration: reduceMotion ? 0 : motion.standard.duration,
            easing: Easing.bezier(...motion.standard.bezier),
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished && token === shareTransition.current) onDone?.();
        });
    };

    const selectShareMode = (nextMode) => {
        if (actionBusy.current || shareMode === nextMode) return;
        if (nextMode === "pdf" && !canExportPdf) return;
        const token = ++shareTransition.current;
        if (!shareMode) {
            setShareContentHeight(0);
            setShareMode(nextMode);
            return;
        }
        setShareExpanded(false);
        animateShareFold(0, token, () => {
            setShareContentHeight(0);
            setShareMode(nextMode);
        });
    };

    const measureShareContent = (height) => {
        const measuredHeight = Math.ceil(height);
        if (!shareMode || !measuredHeight || measuredHeight === shareContentHeight) return;
        const token = ++shareTransition.current;
        setShareContentHeight(measuredHeight);
        animateShareFold(measuredHeight, token, () => setShareExpanded(true));
    };

    // ---- result view ----
    const renderAccessLogEntry = (entry) => (
        <ListEntryCard
            key={entry.id}
            title={entry.professional_name || "Unnamed professional"}
            dateText={shortDate(accessDateParts(entry.access_date).date) || "Date not recorded"}
            label={
                <View style={[styles.statusPill, styles.pillDim]}>
                    <Text style={[styles.pillText, styles.accessCodeText]} accessibilityLabel={`QR code ${entry.code || "unavailable"}`}>
                        {entry.code || "Unavailable"}
                    </Text>
                </View>
            }
            labelTrailing
            onPress={() => {
                setDisplayedShare(null);
                setDetailAccessEntry(entry);
            }}
            accessibilityLabel={`View access details for ${entry.professional_name || "unnamed professional"}`}
        />
    );

    // ---- builder view ----
    return (
        <KeyboardAvoider>
        <Animated.ScrollView
            key="share-builder"
                ref={scrollViewRef}
                contentContainerStyle={[styles.scroll, { paddingTop: padTop, paddingBottom: padBottom }]}
                refreshControl={refreshControl}
                keyboardShouldPersistTaps="handled"
                {...scrollProps}
            >
            <View style={styles.intro}><Text accessibilityRole="header" style={styles.screenTitle}>Share Baby Records</Text>
                <Text style={styles.stepDescription}>Choose what information to include and generate a shareable record.</Text></View>
            <ShareStepCard step={1} title="Choose Records To Share" description="Select the information you want to include in the shared record.">
                <View testID="share-record-grid" style={styles.recordGrid} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>
                    {allKeys.map(k => <Control key={k} testID={`share-record-${k}`} material={{ surface: p.tiles[k], active: [p.tiles[k][1], p.tiles[k][1], p.tiles[k][2]] }}
                        active={selected.has(k)} radius={20} disabled={busy} onPress={() => toggle(k)} accessibilityRole="checkbox"
                        accessibilityLabel={RECORD_LABELS[k]} aria-checked={selected.has(k)} accessibilityState={{ checked: selected.has(k), disabled: busy }}
                        accessibilityHint={k === "nutrition" ? "Includes feeding entries and saved milk-type periods with notes." : undefined}
                        style={[styles.recRow, { width: tileWidth }, compactTiles && styles.recCompact]}>
                        <View style={[styles.checkbox, selected.has(k) && styles.checkboxOn]} accessible={false}>
                            {selected.has(k) ? <Ionicons name="checkmark" size={18} color={p.onCta} /> : null}</View>
                        <ShareRecordIcon kind={k} profile={profile} />
                        <View style={[styles.recBody, compactTiles && styles.recBodyCompact]}><Text style={styles.recLabel}>{RECORD_LABELS[k]}</Text>
                            {k === "nutrition" ? <Text style={styles.recHint}>Feeds, milk-type periods &amp; notes.</Text> : null}</View>
                    </Control>)}
                </View>
                <View style={styles.shareTip}><Surface colors={p.info} highlight={p.highlight} radius={20} />
                    <Ionicons accessible={false} name="information-circle" size={30} color={p.azure} />
                    <Text style={styles.shareTipText}>Choose what information can be seen. QR access is read-only and expires after the selected duration. Saved PDFs do not expire and cannot be remotely revoked.</Text>
                </View>
            </ShareStepCard>
            <ShareStepCard step={2} title="What Is This Visit About?" description="Optional. Add a brief note for the healthcare provider. It is included in both QR sharing and PDF exports.">
                <View style={[styles.reasonField, noteFocused && { borderColor: p.azure }]}><Surface colors={p.panel} highlight={p.highlight} radius={22} />
                    <TextInput accessibilityLabel="What is this visit about?" value={visitReason} editable={!busy}
                        onChangeText={value => { if (actionBusy.current) return; if (value.length <= VISIT_REASON_MAX) setVisitReason(value); else alert("Keep the visit note to 500 characters."); }}
                        placeholder="e.g. Coughing for 4 days, worse at night, not eating well" placeholderTextColor={p.secondary}
                        onFocus={() => setNoteFocused(true)} onBlur={() => setNoteFocused(false)} multiline maxLength={VISIT_REASON_MAX} style={styles.reasonInput} />
                </View>
                <Text testID="share-note-count" style={styles.reasonCount}>{visitReason.length}/{VISIT_REASON_MAX}</Text>
            </ShareStepCard>
            <ShareStepCard step={3} title="Choose How To Share" description="Generate a temporary QR code or save the selected records as a PDF.">
                <View style={styles.methodRow}><Surface colors={p.panel} highlight={p.highlight} radius={999} />
                    {SHARE_METHODS.map(option => {
                        const active = shareMode === option.key, disabled = busy || option.key === "pdf" && !canExportPdf;
                        return <Control key={option.key} material={{ surface: p.control, active: p.methodActive }} active={active} radius={999}
                            style={[styles.methodBtn, disabled && styles.methodBtnDisabled]} onPress={() => selectShareMode(option.key)} disabled={disabled}
                            accessibilityRole="button" accessibilityLabel={`${option.label} sharing`} accessibilityState={{ selected: active, expanded: active && shareExpanded, disabled }}>
                            <Ionicons accessible={false} name={option.key === "qr" ? "qr-code" : "document-text"} size={21} color={active ? p.azure : p.secondary} />
                            <Text style={[styles.methodText, active && styles.methodTextOn]}>{option.label}</Text>
                        </Control>;
                    })}
                </View>
                {!canExportPdf ? <Text style={styles.recHint}>PDF export is unavailable on this build.</Text> : null}
                {!selected.size ? <Text accessibilityRole="alert" style={styles.recHint}>Select at least one record category to share.</Text> : null}
                {shareMode ? <Animated.View style={[styles.shareActionClip, { overflow: shareExpanded ? "visible" : "hidden",
                    height: shareFold, opacity: shareExpanded ? 1 : shareFold.interpolate({ inputRange: [0, Math.max(1, shareContentHeight)], outputRange: [0, 1], extrapolate: "clamp" }) }]}
                    pointerEvents={shareExpanded ? "auto" : "none"} accessibilityElementsHidden={!shareExpanded} importantForAccessibility={shareExpanded ? "auto" : "no-hide-descendants"}>
                    <View style={styles.shareActionContent} onLayout={event => measureShareContent(event.nativeEvent.layout.height)}>
                        {shareMode === "qr" ? <><Text style={styles.durationTitle}>Set Access Duration</Text><Text style={styles.durationDescription}>This QR code will expire after the selected time.</Text>
                            <DurationWheel value={ttl} onChange={value => { if (!actionBusy.current) setTtl(value); }} disabled={busy} />
                            {ttl >= 1440 ? <Text style={styles.ttlHint}>Longer codes may show older data by the time they are viewed.</Text> : null}</> : <Text style={styles.durationDescription}>The PDF contains the selected records and visit note. Saved copies do not expire.</Text>}
                        <Control material={{ surface: p.cta }} radius={999} style={[styles.genBtn, (busy || !selected.size) && styles.methodBtnDisabled]}
                            onPress={shareMode === "qr" ? handleGenerate : handleExportPdf} disabled={busy || !selected.size}
                            accessibilityRole="button" accessibilityLabel={shareMode === "qr" ? "Generate Consultation QR" : "Save Records as PDF"} accessibilityState={{ disabled: busy || !selected.size, busy }}>
                            {busy ? <PulseLoader color={p.onCta} /> : <Ionicons accessible={false} name={shareMode === "qr" ? "qr-code" : "document-text"} size={22} color={p.onCta} />}
                            <Text style={styles.genText}>{busy ? shareMode === "qr" ? "Generating QR..." : "Preparing PDF..." : shareMode === "qr" ? "Generate Consultation QR" : "Save Records as PDF"}</Text>
                        </Control>
                    </View>
                </Animated.View> : null}
            </ShareStepCard>

            <View onLayout={handleRecentSharesLayout}>
                <SectionContainerCard title="Active & recent shares" headerStyle={recordListLayout.header} style={recordListLayout.section}>
                    <View style={recordListLayout.inset}>{readStatus(shareCache, "shares")}</View>
                    <View style={recordListLayout.inset}>{!historyKnown ? loading ? <AppointmentsSkeleton /> : <Text style={styles.readStatusText}>{t("screenDataUnavailable")}</Text> : null}</View>
                    <View style={recordListLayout.inset}>{historyKnown && history.length === 0 && (
                        <EmptyStateCard message="No shares yet. Generate a QR code above." icon="qr-code-outline" />
                    )}</View>
                    <AnimatedReveal contentStyle={recordListLayout.content}>
                    {history.slice(0, historyVisible).map((s) => {
                        const countdown = s.status === "active" ? formatShareCountdown(s.expiration_date, now) : null;
                        const label = `${s.status === "active" ? "View QR code" : "View share details"} ${s.code}`;
                        const row = (
                            <ListEntryCard
                                key={s.id}
                                style={s.status === "active" ? { marginBottom: 0, boxShadow: "none" } : undefined}
                                title={s.code}
                                dateText={shareGeneratedDateText(s.generate_date || s.created_at)}
                                label={
                                    <View style={[
                                        styles.statusPill,
                                        s.status === "active" ? [styles.pillActive, styles.timerPill] : styles.pillDim,
                                    ]}>
                                        <Text
                                            style={[
                                                styles.pillText,
                                                s.status === "active" && styles.timerText,
                                                { color: s.status === "active" ? colors.shared : colors.textMuted },
                                            ]}
                                            accessibilityLabel={countdown?.accessibilityLabel || `${s.status} share`}
                                        >
                                            {countdown?.text || s.status}
                                        </Text>
                                    </View>
                                }
                                labelTrailing
                                onPress={s.status === "active" ? undefined : () => setDisplayedShare(s)}
                                accessibilityLabel={label}
                            />
                        );
                        return s.status === "active" ? (
                            <SwipeActionRow
                                key={s.id}
                                open={openShareSwipeId === s.id}
                                onOpen={() => setOpenShareSwipeId(s.id)}
                                onClose={() => setOpenShareSwipeId(null)}
                                onPress={() => setDisplayedShare(s)}
                                label={label}
                                actions={[{
                                    key: "revoke",
                                    label: "Revoke",
                                    icon: "close-circle-outline",
                                    color: colors.onAccent,
                                    kind: "delete",
                                    onPress: () => {
                                        setOpenShareSwipeId(null);
                                        setRevokeCandidate(s);
                                    },
                                }]}
                            >
                                {row}
                            </SwipeActionRow>
                        ) : row;
                    })}
                    <ShowMore
                        total={history.length}
                        visible={historyVisible}
                        onPress={() => setHistoryVisible((c) => c + 10)}
                        noun="shares"
                    />
                    </AnimatedReveal>
                </SectionContainerCard>
            </View>

            {(
                <View onLayout={handleAccessLogLayout}>
                <SectionContainerCard title="Access log" subtitle="Who viewed shared records" headerStyle={recordListLayout.header} style={recordListLayout.section}>
                    <View style={recordListLayout.inset}>{readStatus(logCache, "access-log")}</View>
                    <View style={recordListLayout.inset}>{!logKnown ? loading ? <AppointmentsSkeleton /> : <Text style={styles.readStatusText}>{t("screenDataUnavailable")}</Text> : null}</View>
                    <View style={recordListLayout.inset}>{logKnown && accessLog.length === 0 && (
                        <EmptyStateCard message="No one has viewed shared records yet." icon="eye-outline" />
                    )}</View>
                    <AnimatedReveal contentStyle={recordListLayout.content}>
                    {accessLog.slice(0, logVisible).map(renderAccessLogEntry)}
                    <ShowMore
                        total={accessLog.length}
                        visible={logVisible}
                        onPress={() => setLogVisible((c) => c + 10)}
                        noun="log entries"
                    />
                    </AnimatedReveal>
                </SectionContainerCard>
                </View>
            )}

            <PlanDetail
                visible={!!detailAccessEntry}
                plan={accessDetailPlan}
                onClose={() => setDetailAccessEntry(null)}
            />

            <PlanDetail
                visible={!!currentShare}
                plan={shareDetailPlan}
                onClose={() => setDisplayedShare(null)}
                onDelete={currentShare?.status === "active" ? () => setRevokeCandidate(currentShare) : undefined}
                deleteAccessibilityLabel={currentShare?.status === "active" ? `Revoke QR code ${currentShare.code}` : undefined}
                deleting={revokingId === currentShare?.id}
                heroContent={currentShare?.status === "active" ? (
                    <View style={styles.shareQrSection}>
                        <Animated.View style={[styles.qrWrap, { transform: [{ scale: pulseAnim }] }]}>
                            <QrCodeView value={currentShare.qr_payload || qrPayloadForCode(currentShare.code)} size={qrWidth} />
                            <Text style={styles.qrCodeText} selectable accessibilityLabel={`QR code ${currentShare.code}`}>
                                {currentShare.code}
                            </Text>
                        </Animated.View>
                    </View>
                ) : null}
            >
                {currentShare ? (
                    <SectionContainerCard title="Records Shared">
                        {(currentShare.shared_record_keys || []).length ? (
                            currentShare.shared_record_keys.map((key) => (
                                <View key={key} style={styles.recRow}>
                                    <Text style={styles.recLabel}>{RECORD_LABELS[key] || key}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noShareViews}>None</Text>
                        )}
                    </SectionContainerCard>
                ) : null}
                {currentShare ? (
                    <SectionContainerCard title="Who Viewed This QR Code" headerStyle={recordListLayout.header} style={recordListLayout.section}>
                        <View style={recordListLayout.inset}>{readStatus(logCache, "access-log")}</View>
                        {!logKnown ? (
                            loading ? <AppointmentsSkeleton count={2} /> : <Text style={styles.readStatusText}>{t("screenDataUnavailable")}</Text>
                        ) : currentShareAccessLog.length ? (
                            <AnimatedReveal contentStyle={recordListLayout.content}>
                                {currentShareAccessLog.slice(0, logVisible).map(renderAccessLogEntry)}
                                <ShowMore
                                    total={currentShareAccessLog.length}
                                    visible={logVisible}
                                    onPress={() => setLogVisible((count) => count + 10)}
                                    noun="views"
                                />
                            </AnimatedReveal>
                        ) : (
                            <Text style={styles.noShareViews}>No one has viewed this QR code yet.</Text>
                        )}
                    </SectionContainerCard>
                ) : null}
            </PlanDetail>

            <DeleteConfirmation
                visible={!!revokeCandidate}
                title="Revoke share?"
                message={`Revoke QR code "${revokeCandidate?.code || ""}"? Anyone using it will immediately lose access.`}
                deleteLabel="Revoke Share"
                busy={revokingId === revokeCandidate?.id}
                onCancel={() => setRevokeCandidate(null)}
                onConfirm={confirmRevoke}
            />

        </Animated.ScrollView>
        </KeyboardAvoider>
    );
}

const makeStyles = (colors) => {
    const p = colors.shareSurface;
    return StyleSheet.create({
    readStatus: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginVertical: space.sm },
    readStatusText: { ...type.caption, color: colors.textMuted, flexShrink: 1 },
    readRetry: { minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
    readRetryText: { ...type.label, color: colors.primary },
    scroll: { padding: space.lg },
    intro: { gap: 6, marginBottom: 20 }, screenTitle: { ...type.title, fontSize: 23, lineHeight: 29, color: p.text },
    stepCard: { padding: 16, marginBottom: 20, borderRadius: 28, boxShadow: p.panelShadow, backgroundColor: p.panel[0], overflow: "visible" },
    stepHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
    stepNumber: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", boxShadow: p.iconShadow, flexShrink: 0 },
    stepNumberText: { ...type.title, fontSize: 22, lineHeight: 28, color: p.azure }, stepHeading: { flex: 1, minWidth: 0, gap: 4 },
    stepTitle: { ...type.bodyStrong, fontSize: 17, lineHeight: 24, color: p.text }, stepDescription: { ...type.caption, fontSize: 13, lineHeight: 19, color: p.secondary },
    stepContent: { gap: 12 }, recordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 4 },
    recRow: { minHeight: 84, padding: 12, flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 10 },
    recCompact: { flexWrap: "wrap", minHeight: 144, justifyContent: "center", alignContent: "center" },
    recBody: { flex: 1, minWidth: 0, gap: 4 }, recBodyCompact: { flexBasis: "100%", flexGrow: 0, flexShrink: 0 },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: p.secondary, alignItems: "center", justifyContent: "center", backgroundColor: p.panel[0], flexShrink: 0 },
    checkboxOn: { backgroundColor: p.azure, borderColor: p.azure }, recLabel: { ...type.label, fontSize: 14, lineHeight: 20, color: p.text },
    recHint: { ...type.caption, fontSize: 11, lineHeight: 17, color: p.secondary },
    shareTip: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 20, boxShadow: p.iconShadow },
    shareTipText: { flex: 1, ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary },
    reasonField: { borderWidth: 1, borderColor: colors.appointmentDashboard.divider, borderRadius: 22, boxShadow: p.iconShadow },
    reasonInput: { position: "relative", minHeight: 104, padding: 14, ...type.body, fontSize: 14, lineHeight: 21, color: p.text, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
    reasonCount: { ...type.caption, fontSize: 12, color: p.secondary, textAlign: "right" },
    methodRow: { flexDirection: "row", borderRadius: 999, padding: 5, gap: 6, boxShadow: p.iconShadow },
    methodBtn: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: "center", flexDirection: "row", flexWrap: "wrap", gap: 7, paddingVertical: 9, paddingHorizontal: 6, alignItems: "center" },
    methodBtnDisabled: { opacity: 0.55 }, methodText: { ...type.label, fontSize: 13, lineHeight: 19, color: p.secondary }, methodTextOn: { color: p.azure },
    shareActionClip: { overflow: "hidden" }, shareActionContent: { position: "absolute", top: 0, left: 0, right: 0, padding: 8, gap: 12 },
    durationTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 22, color: p.text, textAlign: "center" }, durationDescription: { ...type.caption, fontSize: 12, lineHeight: 18, color: p.secondary, textAlign: "center" },
    ttlHint: { ...type.caption, fontSize: 12, color: p.secondary, lineHeight: 18 },
    genBtn: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56, paddingVertical: 14, paddingHorizontal: 12, boxShadow: p.ctaShadow },
    genText: { ...type.bodyStrong, fontSize: 15, lineHeight: 21, color: p.onCta, textAlign: "center", flexShrink: 1 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    timerPill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 11 },
    pillActive: { backgroundColor: colors.sharedBg },
    pillDim: { backgroundColor: colors.surfaceAlt },
    pillText: { ...type.caption, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    timerText: { textTransform: "none", minWidth: 32, textAlign: "center", fontSize: 15, lineHeight: 23 },
    accessCodeText: { color: colors.primaryDark },
    shareQrSection: { alignItems: "center" },
    qrWrap: {
        width: "100%", alignItems: "center", backgroundColor: colors.surface,
        borderRadius: radius.xl, borderCurve: "continuous", overflow: "hidden",
        borderWidth: 1, borderColor: colors.hairline, paddingBottom: space.xl,
    },
    qrCodeText: {
        ...type.title,
        fontSize: type.title.fontSize * 1.625,
        lineHeight: type.title.lineHeight * 1.625,
        color: colors.text,
        letterSpacing: 3,
        marginTop: space.md,
        textAlign: "center",
    },
    noShareViews: { ...type.caption, color: colors.textMuted, paddingVertical: space.sm },
    });
};
