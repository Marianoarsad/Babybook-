import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurTargetView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { type } from "../theme";
import { ageAtDate, shortDate } from "../utils/dates";
import { useConfirmedRecords, useSessionEpoch } from "../utils/useRecords";
import { memoryToApp, milestoneToApp } from "../utils/adapters";
import { api } from "../utils/api";
import store from "../utils/recordStore.cjs";
import { exportMemoryPhoto } from "../utils/memoryPhoto";
import Modal from "./ui/AppModal";
import Gradient from "./ui/Gradient";
import RecordIcon from "./ui/RecordIcon";
import ImageViewer from "./ui/ImageViewer";
import AddMemoryModal from "./ui/AddMemoryModal";
import AnchoredMenu, { AnchoredMenuItem } from "./ui/AnchoredMenu";
import { DeleteConfirmation } from "./ui/RecordFormSheet";
import { DashboardSurface, DashboardControl } from "./ui/ConsultationsAppointmentsCard";
import { useToast } from "./ui/Toast";

function DetailIcon({ name, tone = "blue", size = 42, milestone = false, calendar = false, baby = false, destructive = false }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard, art = colors.profileSurface;
    if (milestone) return <RecordIcon category="milestone" size={size} />;
    return <Gradient accessible={false} pointerEvents="none" colors={art.icon[tone]}
        style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, alignItems: "center", justifyContent: "center",
            boxShadow: `${p.rowShadow}, inset 1px 2px 3px ${p.highlight}` }}>
        {calendar ? <Image accessible={false} source={require("../assets/navbar/calendar-blue.png")}
            resizeMode="contain" style={{ width: size * 0.7, height: size * 0.7 }} /> : baby ?
            <Svg accessible={false} aria-hidden width={size * 0.7} height={size * 0.7} viewBox="0 0 36 36" style={{ position: "relative" }}>
                <Path d="M7 17c-5-1-5 7 0 7M29 17c5-1 5 7 0 7" fill="none" stroke={art.glyph[tone]} strokeWidth="2.5" />
                <Circle cx="18" cy="20" r="12" fill={p.reflection} fillOpacity="0.4" stroke={art.glyph[tone]} strokeWidth="2.5" />
                <Path d="M18 11c8-7-2-10-3-5s8 5 6-1M14 25q4 4 8 0" fill="none" stroke={art.glyph[tone]} strokeWidth="2.5" strokeLinecap="round" />
                <Circle cx="13" cy="19" r="1.3" fill={art.glyph[tone]} /><Circle cx="23" cy="19" r="1.3" fill={art.glyph[tone]} />
            </Svg> : <Ionicons name={name} size={size * 0.53} color={destructive ? colors.danger : art.glyph[tone]} />}
    </Gradient>;
}

function Metric({ label, value, icon, styles, palette }) {
    return <View testID={`memory-metric-${label.toLowerCase()}`} style={styles.metric}>
        <DashboardSurface colors={palette.row} highlight={palette.highlight} radius={22} />
        {icon}<View style={styles.metricText}><Text style={[styles.label, styles.metricLabel]}>{label}</Text><Text style={styles.value}>{value || "Not recorded"}</Text></View>
    </View>;
}

// Resolve the selected ID against this child's confirmed cache so edits propagate
// across entry points and removed records cannot leave stale actions behind.
export default function MemoryDetail({ visible, memory, profile, recordKind = "memory", onClose }) {
    const epoch = useSessionEpoch();
    if (!visible || !memory || String(memory.childId) !== String(profile.id)) return null;
    return <Detail key={`${epoch}:${profile.id}:${recordKind}:${memory.id}`} id={memory.id} profile={profile}
        recordKind={recordKind} epoch={epoch} onClose={onClose} />;
}

function Detail({ id, profile, recordKind, epoch, onClose }) {
    const { colors } = useTheme(), p = colors.appointmentDashboard;
    const styles = useMemo(() => makeStyles(p), [p]);
    const insets = useSafeAreaInsets(), { width, fontScale } = useWindowDimensions();
    const resource = recordKind === "milestone" ? "milestones" : "memories";
    const rows = useConfirmedRecords(profile.id, resource);
    const raw = rows.find(row => String(row.id) === String(id));
    const memory = raw ? (recordKind === "milestone" ? milestoneToApp(raw) : memoryToApp(raw)) : null;
    const label = recordKind === "milestone" ? "Milestone" : "Photo Memory";
    const toast = useToast(), menuRef = useRef(null), blurTarget = useRef(null), pending = useRef(false), active = useRef(true);
    const [anchor, setAnchor] = useState(null), [zoom, setZoom] = useState(false), [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false), [busy, setBusy] = useState(""), [deleteError, setDeleteError] = useState("");
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    useEffect(() => { if (!raw) onClose(); }, [raw, onClose]);
    const isCurrent = () => active.current && store.getEpoch() === epoch;
    const run = async (action, operation) => {
        if (pending.current || !isCurrent() || !raw) return;
        pending.current = true; setBusy(action); setAnchor(null);
        try { await operation(); }
        catch (error) {
            if (isCurrent()) {
                if (action === "delete") setDeleteError(error.message || "Could not delete this record. Try again.");
                else toast.error(error.message || "This action could not be completed. Try again.");
            }
        } finally { pending.current = false; if (isCurrent()) setBusy(""); }
    };
    if (!memory) return null;
    const edit = () => { if (!pending.current) { setAnchor(null); setEditing(true); } };
    const confirmDelete = () => { if (!pending.current) { setAnchor(null); setDeleteError(""); setDeleting(true); } };
    const favorite = () => run("favorite", async () => {
        await api.updateRecord(profile.id, resource, id, { is_favorite: !memory.isFavorite }, { sessionEpoch: epoch });
        if (isCurrent()) toast.success(memory.isFavorite ? "Removed from Favorites" : "Added to Favorites");
    });
    const exportPhoto = action => run(action, async () => {
        const result = await exportMemoryPhoto(action, memory, recordKind, isCurrent);
        if (!isCurrent() || result === "cancelled") return;
        if (result === "saved") toast.success("Original photo saved");
        else toast.info({ shared: "Photo share completed", presented: "Photo share sheet closed", requested: "Download requested. Check your browser's downloads." }[result]);
    });
    const actions = [
        { key: "share", label: "Share", icon: "share-social-outline", tone: "blue", onPress: () => exportPhoto("share"), photo: true },
        { key: "download", label: "Download", icon: "download-outline", tone: "mint", onPress: () => exportPhoto("download"), photo: true },
        { key: "favorite", label: memory.isFavorite ? "Favorited" : "Add to Favorites", icon: memory.isFavorite ? "heart" : "heart-outline", tone: "pink", onPress: favorite },
        { key: "delete", label: "Delete", icon: "trash-outline", tone: "pink", onPress: confirmDelete },
    ];
    const close = () => { if (!pending.current) onClose(); };
    const compact = width < 350 || fontScale > 1.2;
    const menuActions = [{ key: "edit", label: "Edit", icon: "pencil-outline", tone: "blue", onPress: edit },
        ...actions.filter(action => !action.photo || memory.photoUrl).map(action => ({ ...action,
            label: action.key === "favorite" && memory.isFavorite ? "Remove from Favorites" : action.label }))];
    return <Modal visible animationType="fade" onRequestClose={close}>
        <BlurTargetView ref={blurTarget} style={styles.root}>
        <Gradient colors={[colors.pageGradient[0], p.panel[1], p.panel[2]]} style={styles.root}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), paddingHorizontal: Math.max(insets.left, insets.right, 16) }]}>
                <DashboardControl material={{ surface: p.control }} radius={25} style={styles.roundControl} onPress={close}
                    disabled={!!busy} accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: !!busy }}>
                    <Ionicons name="arrow-back" size={23} color={p.azure} />
                </DashboardControl>
                <Text accessibilityRole="header" style={[styles.headerTitle, compact && { fontSize: 18 }]}>{label} Detail</Text>
                <DashboardControl ref={menuRef} material={{ surface: p.control }} radius={25} style={styles.roundControl}
                    disabled={!!busy} accessibilityRole="button" accessibilityLabel="More record actions" accessibilityState={{ expanded: !!anchor, disabled: !!busy }}
                    onPress={() => menuRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))}>
                    <Ionicons name="ellipsis-horizontal" size={23} color={p.azure} />
                </DashboardControl>
            </View>
            <ScrollView contentContainerStyle={[styles.content, { paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16), paddingBottom: insets.bottom + 28 }]}
                showsVerticalScrollIndicator={false}>
                <DashboardControl testID="memory-photo-frame" material={{ surface: p.panel }} radius={26} style={styles.photoCard}
                    onPress={() => setZoom(true)} disabled={!memory.photoUrl || !!busy}
                    accessibilityRole={memory.photoUrl ? "button" : undefined} accessibilityLabel={memory.photoUrl ? "View complete photo" : "No photo attached"}
                    accessibilityHint={memory.photoUrl ? "Opens the original image full screen" : undefined}
                    accessibilityState={{ disabled: !memory.photoUrl || !!busy }}>
                    <View style={styles.photoClip}>
                        {memory.photoUrl ? <Image accessible={false} source={{ uri: memory.photoUrl }} resizeMode="cover" style={styles.photo} /> :
                            <View style={[styles.photo, styles.placeholder]}><Ionicons name="image-outline" size={40} color={p.secondary} /><Text style={styles.label}>No photo attached</Text></View>}
                    </View>
                </DashboardControl>
                <View testID="memory-details-panel" style={styles.details}>
                    <DashboardSurface colors={p.panel} highlight={p.highlight} radius={26} />
                    <View style={styles.titleRow}>
                        <DetailIcon milestone={recordKind === "milestone"} name="book-outline" tone="gold" />
                        <View style={styles.titleBody}><Text style={styles.label}>Title</Text><Text style={styles.memoryTitle}>{memory.title || "Untitled"}</Text><View style={styles.accent} /></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.notesRow}><DetailIcon name="document-text-outline" /><View style={styles.titleBody}>
                        <Text style={styles.notesLabel}>NOTES</Text><Text style={styles.notes}>{memory.description || "No notes were added."}</Text>
                    </View></View>
                </View>
                <View testID="memory-metadata-row" style={styles.metrics}>
                    <Metric label="Date" value={memory.date ? shortDate(memory.date) : "Not recorded"} styles={styles} palette={p} icon={<DetailIcon size={compact ? 32 : 36} calendar />} />
                    <Metric label="Age" value={ageAtDate(profile.dateOfBirth, memory.date)} styles={styles} palette={p} icon={<DetailIcon size={compact ? 32 : 36} tone="lavender" baby />} />
                    <Metric label="Type" value={label} styles={styles} palette={p} icon={<DetailIcon size={compact ? 32 : 36} milestone={recordKind === "milestone"} name="image-outline" tone="pink" />} />
                </View>
                <View testID="memory-action-tray" style={styles.actionTray}>
                    <DashboardSurface colors={p.panel} highlight={p.highlight} radius={26} />
                    {actions.map(action => <DashboardControl key={action.key} material={{ surface: p.row }} appearance="text" radius={18}
                        style={[styles.action, (busy || (action.photo && !memory.photoUrl)) && { opacity: 0.5 }]} onPress={action.onPress}
                        disabled={!!busy || (action.photo && !memory.photoUrl)} accessibilityRole="button" accessibilityLabel={action.label}
                        accessibilityHint={action.photo && !memory.photoUrl ? "No photo is attached to this record" : undefined}
                        accessibilityState={{ disabled: !!busy || (action.photo && !memory.photoUrl), busy: busy === action.key, ...(action.key === "favorite" ? { selected: memory.isFavorite } : {}) }}>
                        <DetailIcon name={action.icon} tone={action.tone} size={compact ? 40 : 46} />
                        <Text style={styles.actionLabel}>{action.label}</Text>
                    </DashboardControl>)}
                </View>
                {!memory.photoUrl && <Text style={styles.photoHint}>No photo is attached. Share and Download are unavailable.</Text>}
            </ScrollView>
        </Gradient>
        </BlurTargetView>
        <AnchoredMenu visible={!!anchor} anchor={anchor} onClose={() => setAnchor(null)} appearance="actions" blurTarget={blurTarget} dimBackdrop={false}>
            {menuActions.map((action, index) => <AnchoredMenuItem key={action.key} label={action.label} onPress={action.onPress}
                variant="action" divider={index < menuActions.length - 1} disabled={!!busy}
                leading={<DetailIcon name={action.icon} tone={action.tone} size={40} destructive={action.key === "delete"} />} />)}
        </AnchoredMenu>
        <ImageViewer visible={zoom} uri={memory.photoUrl} onClose={() => setZoom(false)} />
        {editing ? <AddMemoryModal visible profile={profile} editMemory={memory} recordKind={recordKind} onClose={() => setEditing(false)} /> : null}
        <DeleteConfirmation visible={deleting} title={`Delete ${label.toLowerCase()}?`} message="This permanently deletes the record and its attached photo. This cannot be undone."
            busy={busy === "delete"} error={deleteError} onCancel={() => { if (!pending.current) setDeleting(false); }}
            onConfirm={() => run("delete", async () => {
                await api.deleteRecord(profile.id, resource, id, { sessionEpoch: epoch });
                if (isCurrent()) { toast.success(`${label} deleted`); onClose(); }
            })} />
    </Modal>;
}

const makeStyles = p => StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16 },
    roundControl: { width: 46, height: 46, flexShrink: 0, alignItems: "center", justifyContent: "center" },
    headerTitle: { ...type.heading, fontSize: 21, lineHeight: 26, fontWeight: "800", color: p.text, textAlign: "center", flex: 1 },
    content: { gap: 16, paddingTop: 6, width: "100%", maxWidth: 800, alignSelf: "center" },
    photoCard: { padding: 7, borderRadius: 26, boxShadow: p.panelShadow },
    photoClip: { aspectRatio: 4 / 3, borderRadius: 20, overflow: "hidden" },
    photo: { width: "100%", height: "100%" }, placeholder: { alignItems: "center", justifyContent: "center", gap: 12 },
    metrics: { flexDirection: "row", gap: 8, alignItems: "stretch" },
    metric: { flex: 1, minWidth: 0, alignItems: "center", gap: 8, borderRadius: 22, paddingHorizontal: 8, paddingVertical: 14, minHeight: 126, boxShadow: p.rowShadow },
    metricText: { alignSelf: "stretch", minWidth: 0, gap: 4 }, label: { ...type.body, fontSize: 14, lineHeight: 20, color: p.secondary },
    metricLabel: { fontSize: 12, textAlign: "center" },
    value: { ...type.body, fontSize: 14, lineHeight: 20, fontWeight: "800", color: p.text, textAlign: "center" },
    details: { padding: 18, borderRadius: 26, boxShadow: p.panelShadow },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12 }, titleBody: { flex: 1, minWidth: 0, gap: 5 },
    memoryTitle: { ...type.heading, fontSize: 22, lineHeight: 28, fontWeight: "800", color: p.text },
    accent: { width: 32, height: 3, borderRadius: 2, backgroundColor: p.azure, marginTop: 3 },
    divider: { height: 1, backgroundColor: p.divider, marginVertical: 18 },
    notesRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    notesLabel: { ...type.caption, fontSize: 12, color: p.secondary, fontWeight: "700", letterSpacing: 0.7 },
    notes: { ...type.body, fontSize: 16, lineHeight: 24, color: p.text },
    actionTray: { flexDirection: "row", alignItems: "stretch", gap: 4, borderRadius: 26, padding: 14, boxShadow: p.rowShadow },
    action: { flex: 1, alignItems: "center", gap: 9, paddingVertical: 4, minWidth: 0 },
    actionLabel: { ...type.caption, fontSize: 12, lineHeight: 17, color: p.secondary, textAlign: "center", fontWeight: "600" },
    photoHint: { ...type.caption, color: p.secondary, textAlign: "center" },
});
