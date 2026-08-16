import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Image,
    useWindowDimensions,
} from "react-native";
import { api } from "../utils/api";
import {
    vaccinationToApp,
    medHistoryToIllness,
    medHistoryToMed,
    medicationDoseToApp,
    checkupToApp,
} from "../utils/adapters";
import {
    scheduleReminder,
    morningOf,
    cancelRemindersOfKind,
    notificationsAvailable,
} from "../utils/notifications";
import {
    doseTimesOf,
    dosesOn,
    courseDayText,
    isActiveOn,
    nextDoseTime,
    upcomingDoseSlots,
} from "../utils/medication";
import { exportChildRecordsPdf, pdfExportAvailable } from "../utils/exportPdf";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { radius, space, type, shadow, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, fitsColumns } from "../utils/responsive";
import {
    SectionContainerCard,
    ListEntryCard,
    EmptyStateCard,
} from "./common/Cards";
import PhotoAttach from "./ui/PhotoAttach";
import ShowMore from "./ui/ShowMore";
import { ImmunizationsSkeleton, AppointmentsSkeleton } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import { DateField, TimeField } from "./ui/DateField";
import ImageViewer from "./ui/ImageViewer";
import OptionSheet from "./ui/OptionSheet";
import MedicalEventModal from "./ui/MedicalEventModal";
import MedicineModal from "./ui/MedicineModal";
import TipStrip from "./ui/TipStrip";
import KeyboardAvoider from "./ui/KeyboardAvoider";
import { shortDate, shortTime, overdueBy, todayLocal, nowLocalTime, spanText } from "../utils/dates";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// How the care level a parent picked reads back on the row. A record of what
// the family did, never a severity grade — "At home" is not "mild".
const CARE_LABELS = {
    home: "Cared for at home",
    doctor: "Saw a doctor",
    hospital: "Admitted to hospital",
};

// One running medicine course, with today's doses along the bottom.
//
// This is the part that makes the tab a tracker rather than a list: the
// question a parent actually has, several times a day, is "have I given this
// yet?" — and until now the app could not answer it at all.
//
// An unfilled slot is drawn as simply not filled. It is never coloured coral or
// amber and never labelled late or missed: the app records what happened and
// does not grade the parent (PRODUCT.md Principle 5).
function MedicineCourseCard({ med, doses, treats, thumbnailUrl, onThumbnailPress, onEdit, onGive, onUndo }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    // The footer holds a button and a status line side by side. Measured, so
    // the pair drops to two lines rather than crushing the status text to
    // ~110pt on a narrow phone or at a raised font scale.
    const [footWidth, setFootWidth] = useState(0);
    const footTwoCol = fitsColumns(footWidth, 2, space.sm);
    const times = doseTimesOf(med);
    const given = doses.length;
    const extra = Math.max(0, given - times.length);
    const next = nextDoseTime(times, given);
    const dayText = courseDayText(med.date, med.courseDays, todayLocal());
    const detail = [med.doseAmount, med.frequencyPerDay ? `${med.frequencyPerDay} times a day` : ""]
        .filter(Boolean)
        .join("  ·  ");

    return (
        <View style={styles.courseCard}>
            <View style={styles.courseHead}>
                <View style={[styles.listIconTile, { backgroundColor: colors.recMedication.bg }]}>
                    <Ionicons name="flask-outline" size={18} color={colors.recMedication.on} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.courseTitle}>{med.title}</Text>
                    {detail ? <Text style={styles.courseDetail}>{detail}</Text> : null}
                    <Text style={styles.courseMeta}>
                        {[dayText, treats ? `for ${treats}` : ""].filter(Boolean).join("  ·  ")}
                    </Text>
                </View>
                {thumbnailUrl ? (
                    <TouchableOpacity
                        onPress={onThumbnailPress}
                        style={styles.courseThumbWrap}
                        accessibilityRole="imagebutton"
                        accessibilityLabel="View attached photo"
                    >
                        <Image source={{ uri: thumbnailUrl }} style={styles.courseThumb} />
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                    onPress={onEdit}
                    style={styles.rowEditBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${med.title}`}
                >
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {times.length > 0 && (
                <>
                    <View style={styles.doseRowWrap}>
                        {times.map((tval, i) => {
                            const done = i < given;
                            return (
                                <TouchableOpacity
                                    key={`${tval}-${i}`}
                                    style={[styles.doseSlot, done && styles.doseSlotOn]}
                                    disabled={!done}
                                    onPress={() => done && onUndo(doses[i])}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        done
                                            ? `Dose at ${shortTime(tval)} given — tap to undo`
                                            : `Dose at ${shortTime(tval)} not given yet`
                                    }
                                >
                                    <Ionicons
                                        name={done ? "checkmark-circle" : "ellipse-outline"}
                                        size={14}
                                        color={done ? colors.onPrimary : colors.textMuted}
                                    />
                                    <Text style={[styles.doseSlotText, done && styles.doseSlotTextOn]}>
                                        {shortTime(tval)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                        {extra > 0 && <Text style={styles.doseExtra}>+{extra} more today</Text>}
                    </View>

                    {/* Button on the LEFT. The floating "+" is anchored to the
                        bottom-right of the screen and floats over this list, so
                        a right-aligned primary action ends up underneath it at
                        the wrong scroll position. The status text takes the
                        right-hand side, where being partly covered costs
                        nothing. */}
                    <View
                        style={[styles.courseFoot, !footTwoCol && styles.courseFootStacked]}
                        onLayout={(e) => setFootWidth(e.nativeEvent.layout.width)}
                    >
                        <TouchableOpacity
                            onPress={onGive}
                            style={styles.giveBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Record a dose of ${med.title}`}
                        >
                            <Ionicons name="add" size={15} color={colors.onPrimary} />
                            <Text style={styles.giveBtnText} numberOfLines={1}>
                                Record a dose
                            </Text>
                        </TouchableOpacity>
                        <Text
                            style={[styles.courseNext, !footTwoCol && styles.courseNextStacked]}
                            numberOfLines={2}
                        >
                            {given >= times.length
                                ? `All ${times.length} recorded today`
                                : `${given} of ${times.length} today${next ? ` · next at ${shortTime(next)}` : ""}`}
                        </Text>
                    </View>
                </>
            )}
        </View>
    );
}

export default function Health({
    profile,
    onUpdateProfile,
    immunizations,
    setImmunizations,
    initialTab,
    navKey,
}) {
    const { language, t } = useLanguage();
    const toast = useToast();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    // Room inside a modal sheet: screen, less the backdrop padding, capped at
    // the card's maxWidth, less the card's own padding. Paired fields (Date /
    // Time) drop to one per line when that can't give each a readable column.
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const modalTwoCol = fitsColumns(Math.min(windowWidth - 40, 440) - 40, 2, space.sm);
    const [activeTab, setActiveTab] = useState("immunizations");
    // Apply a deep-link tab request from the floating log button, and — for
    // Deep links into this screen. THE RULE, and it is absolute:
    //
    //   a PLAIN TAB NAME only switches tabs. Only an ALIAS opens a form.
    //
    // Plain: immunizations, medications, illnesses, appointments.
    // Aliases: vaccine, medication, illness, checkup, hospitalization.
    //
    // "appointments" and "medications" used to break this rule by opening a
    // form themselves, which is how tapping a hospitalization on the
    // Dashboard's Needs Attention card — a plain tab switch, deep-linking to
    // "appointments" because hospitalizations live under Checkups — started
    // popping a blank Add Appointment form on top of it. Any new deep link
    // that should only navigate must use a plain name; give it an alias if it
    // should also open something.
    useEffect(() => {
        const tabFor = {
            immunizations: "immunizations",
            medications: "medications",
            illnesses: "illnesses",
            appointments: "appointments",
            vaccine: "immunizations",
            medication: "medications",
            illness: "illnesses",
            checkup: "appointments",
            hospitalization: "appointments",
        };
        const modalFor = {
            vaccine: () => setShowVaxModal(true),
            medication: () => setMedicineForm({ record: null }),
            illness: () => setMedEvent({ kind: "illness", record: null }),
            checkup: () => setShowApptModal(true),
            hospitalization: () => setMedEvent({ kind: "hospitalization", record: null }),
        };
        if (initialTab && tabFor[initialTab]) {
            setActiveTab(tabFor[initialTab]);
            const open = modalFor[initialTab];
            if (open) {
                resetAttach();
                open();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    // Vaccinations now load from and persist to the backend.
    const [vaccines, setVaccines] = useState([]);
    const [vaxLoading, setVaxLoading] = useState(true);
    const loadVaccines = useCallback(() => {
        let active = true;
        setVaxLoading(true);
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "vaccinations");
                if (active) setVaccines(rows.map(vaccinationToApp));
            } catch (e) {
                console.log("load vaccines:", e.message);
            } finally {
                if (active) setVaxLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);
    useEffect(() => loadVaccines(), [loadVaccines]);

    // Checkups now load from and persist to the backend.
    const [appts, setAppts] = useState([]);
    const [apptsLoading, setApptsLoading] = useState(true);
    const [apptsVisible, setApptsVisible] = useState(10);
    const loadAppts = useCallback(() => {
        let active = true;
        setApptsLoading(true);
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "checkups");
                if (active) setAppts(rows.map(checkupToApp));
            } catch (e) {
                console.log("load checkups:", e.message);
            } finally {
                if (active) setApptsLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);
    useEffect(() => loadAppts(), [loadAppts]);

    // Vaccine status/search filter — the full EPI schedule runs to 25 doses,
    // so "what does my child still need?" otherwise means scrolling all of it.
    const [vaxStatusFilter, setVaxStatusFilter] = useState("all");
    const [vaxSearch, setVaxSearch] = useState("");
    const [vaxVisibleCount, setVaxVisibleCount] = useState(10);
    useEffect(() => {
        setVaxVisibleCount(10);
    }, [vaxStatusFilter, vaxSearch]);

    const vaxStatusOf = (v) => {
        if (v.isCompleted) return "done";
        const today = todayLocal();
        if (v.dueDate && v.dueDate < today) return "overdue";
        return "due";
    };

    // "What does my child need, and when?" — the question this tab is opened
    // with, which a flat grouped list never answered. All derived from rows
    // already loaded; no extra request.
    const vaxSummary = useMemo(() => {
        const pending = vaccines.filter((v) => !v.isCompleted && v.dueDate);
        const today = todayLocal();
        const overdue = pending.filter((v) => v.dueDate < today);
        const upcoming = pending
            .filter((v) => v.dueDate >= today)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        // Everything sharing the earliest due date — a clinic visit gives
        // several doses at once, so "next" is a visit, not a single shot.
        const nextDate = upcoming.length ? upcoming[0].dueDate : "";
        return {
            done: vaccines.filter((v) => v.isCompleted).length,
            total: vaccines.length,
            overdue: overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
            next: upcoming.filter((v) => v.dueDate === nextDate),
            nextDate,
        };
    }, [vaccines]);

    const filteredVaccines = useMemo(() => {
        const sorted = [...vaccines].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
        const q = vaxSearch.trim().toLowerCase();
        return sorted.filter((v) => {
            if (vaxStatusFilter !== "all" && vaxStatusOf(v) !== vaxStatusFilter) return false;
            if (q && !`${v.vaccineName} ${v.visitName}`.toLowerCase().includes(q)) return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaccines, vaxStatusFilter, vaxSearch]);

    // Grouped by visit age ("At Birth", "6 Weeks", …) so a full EPI schedule
    // reads like the physical immunization card the parent already knows,
    // instead of a flat wall of ~13 entries. Grouping happens after the
    // filter and the 10-item cap so headers only ever describe what's shown.
    const groupedVaccines = useMemo(() => {
        const groups = new Map();
        for (const v of filteredVaccines.slice(0, vaxVisibleCount)) {
            const key = v.visitName || "Other";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(v);
        }
        return Array.from(groups.entries());
    }, [filteredVaccines, vaxVisibleCount]);

    // Care Team state. No invented fallbacks: these used to default to
    // "Dr. Sarah Chen" and "St. Jude Medical Center", which presented made-up
    // names as though they were this child's actual providers whenever the
    // real fields were blank. PRODUCT.md is explicit that the app must never
    // fabricate a clinic or provider — and a parent in a consultation could
    // reasonably read that as a record.
    const [pediatrician, setPediatrician] = useState(profile.pediatricianName || "");
    const [hospital, setHospital] = useState(profile.hospital || "");

    // Vaccination rows whose attachment photo is present in the record but
    // fails to actually load — see the comment at the thumbnail below.
    const [brokenThumbs, setBrokenThumbs] = useState(() => new Set());

    // Medical conditions states
    const [allergies, setAllergies] = useState(profile.allergies || []);
    const [newAllergy, setNewAllergy] = useState("");

    // Update the allergy list locally and persist it to the child record.
    const persistAllergies = async (updated) => {
        setAllergies(updated);
        onUpdateProfile({ ...profile, allergies: updated });
        try {
            await api.updateChild(profile.id, { allergies: updated });
        } catch (e) {
            console.log("save allergies:", e.message);
        }
    };

    const [illnesses, setIllnesses] = useState([]);
    const [illnessVisible, setIllnessVisible] = useState(10);

    const [medications, setMedications] = useState([]);
    const [medsVisible, setMedsVisible] = useState(10);
    // { record } | null — absent record means "add". Same shape as medEvent.
    const [medicineForm, setMedicineForm] = useState(null);
    // One row per dose actually given, across every medicine for this child.
    const [doses, setDoses] = useState([]);

    const [hospitalizations, setHospitalizations] = useState([]);
    const [hospVisible, setHospVisible] = useState(10);

    // Illnesses and hospital stays share one form (ui/MedicalEventModal.js).
    // `record` absent means add; present means edit — and edit is what makes
    // "this is over now" sayable at all. Nothing in the app could set
    // `resolved` before, so every past illness claimed to still be happening
    // on the Dashboard and in the healthcare professional's view.
    const [medEvent, setMedEvent] = useState(null); // { kind, record } | null

    const handleMedEventSaved = (saved, kind, wasEdit) => {
        const setList = kind === "illness" ? setIllnesses : setHospitalizations;
        setList((prev) =>
            wasEdit ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev],
        );
        // A newly attached photo is not in attachMap yet, and an edit may have
        // replaced the old one. Cheaper and more honest than guessing.
        loadAttachments();
    };

    // How long it lasted, plus where the child was cared for when that was
    // recorded. Both lists used to show a bare date and — for hospital stays —
    // no status at all, while the Dashboard shouted about the same record.
    // A row saved before migration 005 can be resolved with no end date. Fall
    // back to the start date there rather than to spanText's "Ongoing since",
    // which would contradict the "Better" pill sitting right beside it.
    const medEventSubtitle = (r) => {
        const span = r.resolved
            ? r.resolvedDate
                ? spanText(r.date, r.resolvedDate)
                : shortDate(r.date)
            : spanText(r.date, "");
        return [span, CARE_LABELS[r.careLevel], r.facility].filter(Boolean).join("  ·  ");
    };

    // Amber while it is still going, green once it is over. DESIGN.md reserves
    // coral for overdue / error / destructive, and something a child is still
    // getting over is none of those. The word carries the state as well as the
    // colour, so it never rests on hue alone.
    // The illness a medicine is linked to, by id. Illnesses and hospital stays
    // are both offered, since a medicine can follow either.
    const linkableConditions = useMemo(
        () => [...illnesses, ...hospitalizations],
        [illnesses, hospitalizations],
    );
    const conditionTitle = (id) => {
        if (!id) return "";
        const hit = linkableConditions.find((c) => String(c.id) === String(id));
        return hit ? hit.title : "";
    };

    // A finished course, in one line: how long it ran and what it was for.
    const medicineSubtitle = (m) => {
        const span = m.resolvedDate ? spanText(m.date, m.resolvedDate) : shortDate(m.date);
        const treats = conditionTitle(m.treatsId);
        return [span, m.doseAmount, treats ? `for ${treats}` : ""].filter(Boolean).join("  ·  ");
    };

    const statusPill = (resolved, doneWord) => (
        <View style={[styles.statusPill, resolved ? styles.statusPillDone : styles.statusPillOpen]}>
            <Text
                style={[
                    styles.statusPillText,
                    { color: resolved ? colors.success : colors.warning },
                ]}
            >
                {resolved ? doneWord : "Ongoing"}
            </Text>
        </View>
    );

    // Appointment (checkup) adding state
    const [showApptModal, setShowApptModal] = useState(false);
    // Blank, except the date, which sensibly starts at today. These carried
    // prototype placeholders — "Developmental Assessment", "Dr. Sarah Chen",
    // and a hardcoded 2026-06-30 that is now in the past — so opening the form
    // and tapping Schedule saved an invented appointment with an invented
    // doctor on a date nobody chose.
    const [apptTitle, setApptTitle] = useState("");
    const [apptDoctor, setApptDoctor] = useState("");
    const [apptDate, setApptDate] = useState(todayLocal());
    const [apptTime, setApptTime] = useState("");
    const [apptNotes, setApptNotes] = useState("");

    // Medical history (illnesses + medications) loads from the backend.
    const [histLoading, setHistLoading] = useState(true);
    const loadMedHistory = useCallback(() => {
        let active = true;
        setHistLoading(true);
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "medical-history");
                if (!active) return;
                setIllnesses(rows.filter((r) => r.category === "Illness").map(medHistoryToIllness));
                setMedications(rows.filter((r) => r.category === "Medication").map(medHistoryToMed));
                setHospitalizations(rows.filter((r) => r.category === "Hospitalization").map(medHistoryToIllness));
            } catch (e) {
                console.log("load medical history:", e.message);
            } finally {
                if (active) setHistLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);
    useEffect(() => loadMedHistory(), [loadMedHistory]);

    // Every dose given, for every medicine. Small rows, and the Medicine tab
    // needs today's count for each active course, so one request beats one per
    // medicine (PRODUCT.md Principle 3 — assume the worst connection).
    const loadDoses = useCallback(() => {
        let active = true;
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "medication-doses");
                if (active) setDoses(rows.map(medicationDoseToApp));
            } catch (e) {
                console.log("load medication doses:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);
    useEffect(() => loadDoses(), [loadDoses]);

    // ===== Mandatory supporting-photo attachments =====
    const [attachUri, setAttachUri] = useState("");
    const [attachMap, setAttachMap] = useState({}); // `${type}:${id}` -> attachment row
    const [viewer, setViewer] = useState(null); // { uri, type, recordId, attachId }

    const [attachLoading, setAttachLoading] = useState(true);
    const loadAttachments = useCallback(async () => {
        setAttachLoading(true);
        try {
            const rows = await api.listAttachments(profile.id);
            const map = {};
            for (const a of rows) map[`${a.record_type}:${a.record_id}`] = a;
            setAttachMap(map);
        } catch (e) {
            console.log("load attachments:", e.message);
        } finally {
            setAttachLoading(false);
        }
    }, [profile.id]);
    useEffect(() => {
        loadAttachments();
    }, [loadAttachments]);

    const listLoading = vaxLoading || apptsLoading || histLoading || attachLoading;
    const refreshControl = useRefreshControl(listLoading, () => {
        loadVaccines();
        loadAppts();
        loadMedHistory();
        loadAttachments();
    });

    const resetAttach = () => {
        setAttachUri("");
    };
    const hasAttach = () => !!attachUri;
    const requireAttach = () => {
        if (!hasAttach()) {
            toast.error("A supporting photo is required for this record.");
            return false;
        }
        return true;
    };
    const uploadAttachFor = async (recordType, recordId) => {
        try {
            const a = await api.uploadAttachment(profile.id, {
                recordType,
                recordId,
                photoUri: attachUri,
            });
            setAttachMap((prev) => ({ ...prev, [`${recordType}:${recordId}`]: a }));
        } catch (e) {
            console.log("upload attachment:", e.message);
        }
        resetAttach();
    };
    const attachUrlFor = (type, id) => {
        const a = attachMap[`${type}:${id}`];
        return a ? a.file_url : null;
    };
    const openViewer = (type, id) => {
        const a = attachMap[`${type}:${id}`];
        if (a) setViewer({ uri: a.file_url, type, recordId: id, attachId: a.id });
    };
    const replaceInViewer = async () => {
        if (!viewer || !pickerAvailable()) return;
        const uri = await pickImage();
        if (!uri) return;
        try {
            const a = await api.uploadAttachment(profile.id, {
                recordType: viewer.type,
                recordId: viewer.recordId,
                photoUri: uri,
            });
            setAttachMap((prev) => ({ ...prev, [`${viewer.type}:${viewer.recordId}`]: a }));
            setViewer((v) => ({ ...v, uri: a.file_url, attachId: a.id }));
            toast.success("Photo replaced");
        } catch (e) {
            toast.error(e.message || "Could not replace photo");
        }
    };
    const deleteInViewer = async () => {
        if (!viewer) return;
        try {
            await api.deleteAttachment(profile.id, viewer.attachId);
            setAttachMap((prev) => {
                const n = { ...prev };
                delete n[`${viewer.type}:${viewer.recordId}`];
                return n;
            });
            setViewer(null);
            toast.success("Photo removed");
        } catch (e) {
            toast.error(e.message || "Could not delete photo");
        }
    };

    // Add-vaccine modal state.
    const OTHER_VACCINE = "__other__";
    const [showVaxModal, setShowVaxModal] = useState(false);
    const [vaxName, setVaxName] = useState("");
    const [vaxOtherName, setVaxOtherName] = useState("");
    const [vaxDose, setVaxDose] = useState(1);
    const [vaxDue, setVaxDue] = useState("");
    const [vaxPickerOpen, setVaxPickerOpen] = useState(false);

    // The DOH vaccine list, fetched once. Falls back to the names already in
    // this child's own records if the request fails, so an offline parent can
    // still pick rather than type — and never to a hard-coded copy of the
    // schedule, which would drift from the one generating their due dates.
    const [catalogue, setCatalogue] = useState([]);
    useEffect(() => {
        let active = true;
        api.vaccineCatalogue()
            .then((r) => {
                if (active && Array.isArray(r?.vaccines)) setCatalogue(r.vaccines);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    const vaxIsOther = vaxName === OTHER_VACCINE;
    const vaccineOptions = useMemo(() => {
        const fromCatalogue = catalogue.map((v) => ({ key: v.name, label: v.name, doses: v.doses }));
        if (fromCatalogue.length) return fromCatalogue;
        // Offline fallback: whatever this child already has on file.
        const seen = new Map();
        for (const v of vaccines) {
            const base = String(v.vaccineName || "").replace(/\s+\d+$/, "").trim();
            if (base && !seen.has(base)) seen.set(base, { key: base, label: base, doses: 1 });
        }
        return [...seen.values()];
    }, [catalogue, vaccines]);

    // Doses this vaccine has in the schedule, so "which dose" is a choice
    // between real options rather than a number to guess at.
    const vaxDoseOptions = useMemo(() => {
        const hit = vaccineOptions.find((o) => o.key === vaxName);
        const n = hit?.doses || 1;
        return Array.from({ length: n }, (_, i) => i + 1);
    }, [vaccineOptions, vaxName]);

    // Pre-select the lowest dose this child has no record of — the one they
    // are almost certainly here to add.
    useEffect(() => {
        if (!vaxName || vaxIsOther) return;
        const taken = new Set(
            vaccines
                .filter((v) => String(v.vaccineName || "").replace(/\s+\d+$/, "").trim() === vaxName)
                .map((v) => v.doseNumber)
                .filter(Boolean),
        );
        const next = vaxDoseOptions.find((d) => !taken.has(d));
        setVaxDose(next || vaxDoseOptions[0] || 1);
    }, [vaxName, vaccines, vaxDoseOptions, vaxIsOther]);

    const resetVaxForm = () => {
        setVaxName("");
        setVaxOtherName("");
        setVaxDose(1);
        setVaxDue("");
    };

    const handleAddVaccine = async () => {
        const picked = vaxIsOther ? vaxOtherName.trim() : vaxName;
        if (!picked) {
            toast.error(vaxIsOther ? "Please enter a vaccine name" : "Please choose a vaccine");
            return;
        }
        if (!requireAttach()) return;
        const multiDose = !vaxIsOther && vaxDoseOptions.length > 1;
        // The dose stays in the name as well as its own column: every existing
        // row is named this way, and the dedupe that stops the DOH generator
        // duplicating doses compares on that name.
        const name = multiDose ? `${picked} ${vaxDose}` : picked;
        const dose = multiDose ? vaxDose : null;
        const due = vaxDue;
        setShowVaxModal(false);
        resetVaxForm();
        try {
            const saved = await api.createRecord(profile.id, "vaccinations", {
                vaccine_name: name,
                visit_name: null,
                due_date: due || null,
                status: "scheduled",
                dose_number: dose,
            });
            setVaccines((prev) => [...prev, vaccinationToApp(saved)]);
            await uploadAttachFor("vaccination", saved.id);
            // Set a reminder for the due date: notification + backend record.
            const when = morningOf(due);
            if (when) {
                scheduleReminder("Vaccination reminder", `${name} due`, when);
                api
                    .createRecord(profile.id, "reminders", {
                        reminder_type: "Vaccination",
                        title: name,
                        reminder_date: due,
                        status: "Pending",
                        vaccination_id: saved.id,
                    })
                    .catch(() => {});
            }
        } catch (e) {
            toast.error(e.message || "Could not add vaccine");
        }
    };

    // `given` is the date the dose was ACTUALLY administered, not the date the
    // parent got round to recording it. This used to be hard-coded to today,
    // so a dose given last week was filed as today's — and date_given is
    // exactly what the professional portal shows a clinician.
    const applyVaccineToggle = async (vax, nowCompleted, extra = {}) => {
        const given = nowCompleted ? extra.dateGiven || todayLocal() : null;
        // optimistic update
        setVaccines((prev) =>
            prev.map((v) =>
                v.id === vax.id
                    ? {
                          ...v,
                          isCompleted: nowCompleted,
                          completedDate: nowCompleted ? given : undefined,
                          reactionSeverity: nowCompleted ? extra.reactionSeverity || "" : "",
                          reaction: nowCompleted ? extra.reaction || "" : "",
                      }
                    : v,
            ),
        );
        try {
            await api.updateRecord(profile.id, "vaccinations", vax.id, {
                status: nowCompleted ? "completed" : "scheduled",
                date_given: given,
                reaction_severity: nowCompleted ? extra.reactionSeverity || null : null,
                // The description only means anything alongside an actual
                // reaction — same rule as the nutrition form.
                reaction:
                    nowCompleted && extra.reactionSeverity && extra.reactionSeverity !== "none"
                        ? extra.reaction || null
                        : null,
            });
        } catch (e) {
            // revert on failure
            setVaccines((prev) => prev.map((v) => (v.id === vax.id ? vax : v)));
            toast.error(e.message || "Could not update vaccine");
        }
    };

    // Marking a dose "given" requires a supporting photo (vaccination card),
    // same as any other record with a mandatory attachment — but this one
    // is required only at completion time, not while the dose is scheduled.
    // The same step now also captures WHEN it was given and whether anything
    // happened afterwards.
    const [completeVaxTarget, setCompleteVaxTarget] = useState(null);
    const [completeAttachUri, setCompleteAttachUri] = useState("");
    const [completeDate, setCompleteDate] = useState("");
    const [completeReaction, setCompleteReaction] = useState("");
    const [completeReactionNote, setCompleteReactionNote] = useState("");

    const handleToggleVaccine = async (id) => {
        const vax = vaccines.find((v) => v.id === id);
        if (!vax) return;
        const nowCompleted = !vax.isCompleted;
        if (nowCompleted) {
            setCompleteAttachUri("");
            setCompleteDate(todayLocal());
            setCompleteReaction("");
            setCompleteReactionNote("");
            setCompleteVaxTarget(vax);
            return;
        }
        await applyVaccineToggle(vax, false);
    };

    const handleConfirmCompleteWithPhoto = async () => {
        const alreadyAttached = !!attachUrlFor("vaccination", completeVaxTarget?.id);
        if (!completeAttachUri && !alreadyAttached) {
            toast.error("A supporting photo is required to mark this dose given.");
            return;
        }
        const vax = completeVaxTarget;
        setCompleteVaxTarget(null);
        await applyVaccineToggle(vax, true, {
            dateGiven: completeDate,
            reactionSeverity: completeReaction,
            reaction: completeReactionNote,
        });
        if (!completeAttachUri) return;
        try {
            const a = await api.uploadAttachment(profile.id, {
                recordType: "vaccination",
                recordId: vax.id,
                photoUri: completeAttachUri,
            });
            setAttachMap((prev) => ({ ...prev, [`vaccination:${vax.id}`]: a }));
        } catch (e) {
            console.log("upload complete-dose attachment:", e.message);
        }
        setCompleteAttachUri("");
    };

    // DOH EPI schedule generation/backfill — for children created before this
    // feature existed, or whose date of birth was added/corrected afterward.
    const [generatingSchedule, setGeneratingSchedule] = useState(false);
    const hasEpiSchedule = vaccines.some((v) => v.isAutoGenerated);
    const handleGenerateSchedule = async () => {
        setGeneratingSchedule(true);
        try {
            const result = await api.generateEpiSchedule(profile.id, "fill-gaps");
            if (result.inserted > 0) {
                const rows = await api.listRecords(profile.id, "vaccinations");
                setVaccines(rows.map(vaccinationToApp));
                toast.success(`Added ${result.inserted} scheduled dose${result.inserted === 1 ? "" : "s"}.`);
            } else {
                toast.info("No new doses to add.");
            }
        } catch (e) {
            toast.error(e.message || "Could not generate schedule");
        } finally {
            setGeneratingSchedule(false);
        }
    };

    const handleAddAllergy = () => {
        if (!newAllergy.trim()) return;
        persistAllergies([...allergies, newAllergy.trim()]);
        setNewAllergy("");
    };

    // Courses running today, and the ones already done.
    const activeMeds = useMemo(
        () => medications.filter((m) => isActiveOn(m, todayLocal())),
        [medications],
    );
    const pastMeds = useMemo(
        () => medications.filter((m) => !isActiveOn(m, todayLocal())),
        [medications],
    );
    // Names already on this child's record, for the form's chips. The ONLY
    // source of name suggestions — see the header of ui/MedicineModal.js.
    const previousMedNames = useMemo(() => {
        const seen = new Set();
        const out = [];
        for (const m of medications) {
            const key = String(m.title || "").trim().toLowerCase();
            if (key && !seen.has(key)) {
                seen.add(key);
                out.push(m.title.trim());
            }
        }
        return out;
    }, [medications]);

    // Arm dose reminders for the next 48 hours only, replacing whatever was
    // armed before. One 3x-daily week-long course is 21 notifications and iOS
    // allows 64 pending in total, shared with vaccination and checkup
    // reminders — so this is a rolling window topped up whenever the tab is
    // opened, not a one-shot scheduling of the whole course.
    useEffect(() => {
        if (activeTab !== "medications" || !notificationsAvailable()) return;
        let cancelled = false;
        (async () => {
            await cancelRemindersOfKind("medication");
            if (cancelled) return;
            for (const slot of upcomingDoseSlots(activeMeds, new Date(), 48, 24)) {
                if (cancelled) return;
                await scheduleReminder(
                    `Time for ${slot.title}`,
                    slot.dose ? `${slot.dose} for ${profile.name}` : `For ${profile.name}`,
                    slot.at,
                    "medication",
                );
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab, activeMeds, profile.name]);

    const handleMedicineSaved = (saved, wasEdit) => {
        setMedications((prev) =>
            wasEdit ? prev.map((m) => (m.id === saved.id ? saved : m)) : [saved, ...prev],
        );
        loadAttachments();
    };

    // Record a dose as given, now. Optimistic: a parent standing over a child
    // with a syringe should see the slot fill immediately, not after a round
    // trip on clinic wifi. Rolled back if the write fails.
    const handleGiveDose = async (med) => {
        const optimistic = {
            id: `tmp-${Date.now()}`,
            medicationId: String(med.id),
            date: todayLocal(),
            time: nowLocalTime(),
            notes: "",
        };
        setDoses((prev) => [optimistic, ...prev]);
        try {
            const saved = await api.createRecord(profile.id, "medication-doses", {
                medication_id: Number(med.id),
                given_date: optimistic.date,
                given_time: optimistic.time,
            });
            setDoses((prev) => prev.map((d) => (d.id === optimistic.id ? medicationDoseToApp(saved) : d)));
        } catch (e) {
            setDoses((prev) => prev.filter((d) => d.id !== optimistic.id));
            toast.error(e.message || "Could not record the dose");
        }
    };

    // Undo a dose. Tapping a filled slot removes it, because a double-tap has
    // to be correctable — and a record of a dose that was never given is worse
    // than no record at all.
    const handleUndoDose = async (dose) => {
        setDoses((prev) => prev.filter((d) => d.id !== dose.id));
        try {
            await api.deleteRecord(profile.id, "medication-doses", dose.id);
        } catch (e) {
            setDoses((prev) => [dose, ...prev]);
            toast.error(e.message || "Could not undo the dose");
        }
    };

    const handleAddAppointment = async () => {
        if (!apptTitle || !apptDoctor || !apptDate) {
            toast.error("Please fill out required fields");
            return;
        }
        if (!requireAttach()) return;
        setShowApptModal(false);
        // Persist as a checkup (also feeds the QR consultation snapshot).
        try {
            const saved = await api.createRecord(profile.id, "checkups", {
                title: apptTitle,
                doctor_name: apptDoctor,
                checkup_date: apptDate,
                time_of_visit: apptTime || null,
                notes: apptNotes || null,
                status: "scheduled",
            });
            setAppts((prev) => [checkupToApp(saved), ...prev]);
            await uploadAttachFor("checkup", saved.id);
            // Set a reminder: local notification + backend reminder record.
            const when = morningOf(apptDate);
            if (when) {
                scheduleReminder("Checkup reminder", `${apptTitle} with ${apptDoctor}`, when);
                api
                    .createRecord(profile.id, "reminders", {
                        reminder_type: "Checkup",
                        title: apptTitle,
                        reminder_date: apptDate,
                        status: "Pending",
                        checkup_id: saved.id,
                    })
                    .catch(() => {});
            }
            toast.success("Pediatric session scheduled successfully.");
        } catch (e) {
            toast.error(e.message || "Could not save appointment");
        }
    };

    // Secondary export entry point — most parents look for this on the
    // Health screen, not under Privacy Settings. Exports every category.
    const [exportingAll, setExportingAll] = useState(false);
    const handleExportAllRecords = async () => {
        setExportingAll(true);
        try {
            await exportChildRecordsPdf(profile);
        } catch (e) {
            toast.error(e.message || "Could not export records");
        } finally {
            setExportingAll(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
        >
            <TipStrip tipKey="tip_health">
                Every vaccine in the DOH schedule is already here, dated from your child's birthday. Tap one to
                mark it given.
            </TipStrip>

            {/* Care Team Banner Card */}
            <View style={styles.careTeamBox}>
                <View style={styles.careTeamHeader}>
                    <Ionicons
                        name="medical-outline"
                        size={20}
                        color={colors.primary}
                    />
                    <Text style={styles.careTeamTitle}>
                        Care Team Directory
                    </Text>
                </View>
                <Text style={styles.careTeamText}>
                    Pediatrician: {pediatrician || "Not recorded"}
                </Text>
                <Text style={styles.careTeamText}>
                    Hospital: {hospital || "Not recorded"}
                </Text>
                {!pediatrician && !hospital ? (
                    <Text style={styles.careTeamHint}>
                        Add these in your child's profile so they're on hand at a consultation.
                    </Text>
                ) : null}
            </View>

            {pdfExportAvailable() && (
                <TouchableOpacity
                    style={styles.exportPdfBtn}
                    onPress={handleExportAllRecords}
                    disabled={exportingAll}
                >
                    <Ionicons name="download-outline" size={15} color={colors.primary} />
                    <Text style={styles.exportPdfBtnText}>
                        {exportingAll ? "Exporting…" : "Export records as PDF"}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "immunizations" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("immunizations")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            activeTab === "immunizations" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Vaccines
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "medications" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("medications")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            activeTab === "medications" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Medicine
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "illnesses" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("illnesses")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            activeTab === "illnesses" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Conditions
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "appointments" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("appointments")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            activeTab === "appointments" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Checkups
                    </Text>
                </TouchableOpacity>
            </View>

            {/* TAB: VACCINES */}
            {activeTab === "immunizations" && (
                <View>
                    <SectionContainerCard
                        title={t("healthVaccinesTitle")}
                        subtitle={t("healthVaccinesSub")}
                        action={
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                {!vaxLoading && !hasEpiSchedule && (
                                    <TouchableOpacity
                                        onPress={handleGenerateSchedule}
                                        style={[styles.actionBtn, styles.actionBtnAlt]}
                                        disabled={generatingSchedule}
                                    >
                                        <Ionicons name="calendar" size={16} color={colors.primary} />
                                        <Text style={styles.actionBtnAltText}>
                                            {generatingSchedule ? "Generating…" : "Generate schedule"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={() => { resetAttach(); setShowVaxModal(true); }}
                                    style={styles.actionBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Add vaccination"
                                >
                                    <Ionicons name="add" size={16} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        }
                    >
                        {/* The summary sits above the filters because it is the
                            answer, not a way of finding one. Overdue is coral
                            because a missed dose IS overdue; the next visit is
                            informational teal, not a warning. */}
                        {!vaxLoading && vaccines.length > 0 && (
                            <View style={styles.vaxSummary}>
                                {vaxSummary.overdue.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.vaxSummaryRow, styles.vaxSummaryOverdue]}
                                        onPress={() => setVaxStatusFilter("overdue")}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Show ${vaxSummary.overdue.length} overdue doses`}
                                    >
                                        <Ionicons name="alert-circle" size={18} color={colors.danger} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.vaxSummaryTitle}>
                                                {vaxSummary.overdue.length === 1
                                                    ? "1 dose missed"
                                                    : `${vaxSummary.overdue.length} doses missed`}
                                            </Text>
                                            <Text style={styles.vaxSummaryLine}>
                                                {`${vaxSummary.overdue[0].vaccineName} · ${overdueBy(vaxSummary.overdue[0].dueDate)}`}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}

                                {vaxSummary.next.length > 0 && (
                                    <View style={[styles.vaxSummaryRow, styles.vaxSummaryNext]}>
                                        <Ionicons name="calendar-outline" size={18} color={colors.info} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.vaxSummaryTitle}>
                                                {`Next visit · ${shortDate(vaxSummary.nextDate)}`}
                                            </Text>
                                            <Text style={styles.vaxSummaryLine}>
                                                {vaxSummary.next.map((v) => v.vaccineName).join(", ")}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                {vaxSummary.next.length === 0 && vaxSummary.overdue.length === 0 && (
                                    <View style={[styles.vaxSummaryRow, styles.vaxSummaryNext]}>
                                        <Ionicons
                                            name="checkmark-circle-outline"
                                            size={18}
                                            color={colors.success}
                                        />
                                        {/* The flex:1 wrapper the other two
                                            branches have. Without it this Text
                                            sat directly in the row at its own
                                            intrinsic width and overflowed the
                                            card — it is the longest string of
                                            the three. */}
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={styles.vaxSummaryTitle}>
                                                {`Nothing due — ${vaxSummary.done} of ${vaxSummary.total} recorded as given`}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {!vaxLoading && vaccines.length > 0 && (
                            <>
                                <View style={styles.filterRow}>
                                    {[
                                        { key: "all", label: "All" },
                                        { key: "due", label: "Due" },
                                        { key: "done", label: "Done" },
                                        { key: "overdue", label: "Overdue" },
                                    ].map((f) => (
                                        <TouchableOpacity
                                            key={f.key}
                                            onPress={() => setVaxStatusFilter(f.key)}
                                            style={[styles.filterChip, vaxStatusFilter === f.key && styles.filterChipActive]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Filter: ${f.label}`}
                                        >
                                            <Text
                                                numberOfLines={1}
                                                style={[styles.filterChipText, vaxStatusFilter === f.key && styles.filterChipTextActive]}
                                            >
                                                {f.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TextInput
                                    style={[styles.inlineInput, { width: "100%", marginBottom: 12 }]}
                                    placeholder="Search vaccine or visit..."
                                    placeholderTextColor={colors.placeholder}
                                    value={vaxSearch}
                                    onChangeText={setVaxSearch}
                                />
                            </>
                        )}
                        {vaxLoading && <ImmunizationsSkeleton count={4} />}
                        {!vaxLoading && vaccines.length === 0 && (
                            <EmptyStateCard message="No vaccination records yet." icon="shield-checkmark-outline" />
                        )}
                        {!vaxLoading && vaccines.length > 0 && filteredVaccines.length === 0 && (
                            <EmptyStateCard message="No vaccines match this filter." icon="filter-outline" />
                        )}
                        {!vaxLoading && groupedVaccines.map(([visitName, group]) => (
                            <View key={visitName}>
                                <Text style={styles.visitGroupHeader}>{visitName}</Text>
                                {group.map((vax) => (
                                    <TouchableOpacity
                                        key={vax.id}
                                        onPress={() => handleToggleVaccine(vax.id)}
                                        style={styles.vaxRow}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                vax.isCompleted &&
                                                    styles.checkboxChecked,
                                            ]}
                                        >
                                            {vax.isCompleted && (
                                                <Ionicons
                                                    name="checkmark"
                                                    size={14}
                                                    color="#FFFFFF"
                                                />
                                            )}
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                <Text
                                                    style={[
                                                        styles.vaxTitle,
                                                        vax.isCompleted &&
                                                            styles.vaxTitleCompleted,
                                                    ]}
                                                >
                                                    {vax.vaccineName}
                                                </Text>
                                                {vax.isAutoGenerated && (
                                                    <View style={styles.epiChip}>
                                                        <Text style={styles.epiChipText}>EPI</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {/* A given dose used to still read
                                                "Due: 2025-07-19", which
                                                contradicts the tick beside it,
                                                and an overdue one said nothing
                                                at all — the Dashboard knew it
                                                was 11 months late while this
                                                screen, where you act on it,
                                                stayed silent. */}
                                            <Text style={styles.vaxSub}>
                                                {vax.visitName}
                                                {vax.visitName ? " · " : ""}
                                                {vax.isCompleted
                                                    ? `Given ${shortDate(vax.completedDate || vax.dueDate)}`
                                                    : `Due ${shortDate(vax.dueDate)}`}
                                            </Text>
                                            {!vax.isCompleted && overdueBy(vax.dueDate) ? (
                                                <Text style={styles.vaxOverdue}>
                                                    {overdueBy(vax.dueDate)}
                                                </Text>
                                            ) : null}
                                            {/* A recorded reaction is the most
                                                decision-relevant thing on this
                                                row. Amber for mild, coral for
                                                severe — "none" shows nothing,
                                                because a row that says "no
                                                reaction" on every dose is noise
                                                that hides the one that matters. */}
                                            {vax.reactionSeverity === "mild" ||
                                            vax.reactionSeverity === "severe" ? (
                                                <View style={styles.reactionRow}>
                                                    <Ionicons
                                                        name="alert-circle-outline"
                                                        size={13}
                                                        color={
                                                            vax.reactionSeverity === "severe"
                                                                ? colors.danger
                                                                : colors.warning
                                                        }
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.reactionText,
                                                            {
                                                                color:
                                                                    vax.reactionSeverity === "severe"
                                                                        ? colors.danger
                                                                        : colors.warning,
                                                            },
                                                        ]}
                                                    >
                                                        {vax.reactionSeverity === "severe"
                                                            ? "Severe reaction"
                                                            : "Mild reaction"}
                                                        {vax.reaction ? ` · ${vax.reaction}` : ""}
                                                    </Text>
                                                </View>
                                            ) : null}
                                            {vax.notes && (
                                                <Text style={styles.vaxNotes}>
                                                    "{vax.notes}"
                                                </Text>
                                            )}
                                        </View>
                                        {/* Uploads sit on an ephemeral filesystem
                                            (PRODUCT.md, known gaps), so a row can
                                            hold an attachment URL whose image is
                                            gone. Without the onError below that
                                            rendered as an empty grey square on
                                            every row — the same truthy-but-dead
                                            URL problem the Dashboard's avatars
                                            have. */}
                                        {attachUrlFor("vaccination", vax.id) &&
                                        !brokenThumbs.has(vax.id) ? (
                                            <TouchableOpacity
                                                onPress={() => openViewer("vaccination", vax.id)}
                                                style={styles.vaxThumbWrap}
                                            >
                                                <Image
                                                    source={{ uri: attachUrlFor("vaccination", vax.id) }}
                                                    style={styles.vaxThumb}
                                                    onError={() =>
                                                        setBrokenThumbs((prev) =>
                                                            new Set(prev).add(vax.id),
                                                        )
                                                    }
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}
                        {!vaxLoading && (
                            <ShowMore
                                total={filteredVaccines.length}
                                visible={vaxVisibleCount}
                                onPress={() => setVaxVisibleCount((c) => c + 10)}
                                noun="vaccines"
                            />
                        )}
                    </SectionContainerCard>

                    {/* Barangay / NCR vaccine stock bulletin.
                        This content is INVENTED. There is no DOH, barangay or
                        health-centre feed behind it, and PRODUCT.md lists such
                        a partnership under "absences that must never be
                        fabricated". It is kept deliberately, as a placeholder
                        showing where a real integration would sit — so it must
                        stay unmistakably labelled as a sample. Do not remove
                        the badge, and do not reintroduce a specific date: the
                        original said "replenishment by July 5th", which was
                        over a year stale and read as live reporting. */}
                    <SectionContainerCard
                        title={t("healthVaccineNCRStock")}
                        subtitle={t("healthVaccineNCRStockSub")}
                    >
                        <View style={styles.sampleBanner}>
                            <Ionicons name="information-circle" size={16} color={colors.info} />
                            <Text style={styles.sampleBannerText}>
                                Sample data — not a live feed. BabyBook+ is not connected to any DOH
                                or barangay system.
                            </Text>
                        </View>
                        <View style={styles.bulletRow}>
                            <Ionicons
                                name="alert-circle-outline"
                                size={16}
                                color={colors.warning}
                                style={{ marginRight: 6 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bulletTitle}>
                                    Pentavalent vaccine stocks low in NCR
                                    District III
                                </Text>
                                <Text style={styles.bulletDesc}>
                                    Example of a supply notice a health centre might publish.
                                </Text>
                            </View>
                        </View>
                        <View style={styles.bulletRow}>
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={16}
                                color={colors.success}
                                style={{ marginRight: 6 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bulletTitle}>
                                    Measles MMR stocks fully replenished in
                                    Quezon City
                                </Text>
                                <Text style={styles.bulletDesc}>
                                    Example of a restocking notice.
                                </Text>
                            </View>
                        </View>
                    </SectionContainerCard>
                </View>
            )}

            {/* TAB: MEDICINES */}
            {activeTab === "medications" && (
                <View>
                    <SectionContainerCard
                        title={t("healthMedicationReminders")}
                        subtitle={t("healthMedicationRemindersSub")}
                        action={
                            <TouchableOpacity
                                onPress={() => setMedicineForm({ record: null })}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add a medicine"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {histLoading && <AppointmentsSkeleton count={3} />}
                        {!histLoading && medications.length === 0 && (
                            <EmptyStateCard message="Nothing recorded yet." icon="flask-outline" />
                        )}

                        {/* Says plainly what this build can and cannot do. The
                            section was called "Medication Reminders" for a year
                            while the app sent none; it must not now imply the
                            web preview sends them either. */}
                        {!histLoading && activeMeds.length > 0 && !notificationsAvailable() && (
                            <View style={styles.noteBox}>
                                <Ionicons name="information-circle-outline" size={15} color={colors.info} />
                                <Text style={styles.noteText}>
                                    Dose reminders arrive on the phone app. This preview can&apos;t
                                    send them, but everything you record here is saved.
                                </Text>
                            </View>
                        )}

                        {!histLoading &&
                            activeMeds.map((med) => (
                                <MedicineCourseCard
                                    key={med.id}
                                    med={med}
                                    doses={dosesOn(doses, med.id, todayLocal())}
                                    treats={conditionTitle(med.treatsId)}
                                    thumbnailUrl={attachUrlFor("medication", med.id)}
                                    onThumbnailPress={() => openViewer("medication", med.id)}
                                    onEdit={() => setMedicineForm({ record: med })}
                                    onGive={() => handleGiveDose(med)}
                                    onUndo={handleUndoDose}
                                />
                            ))}
                    </SectionContainerCard>

                    {!histLoading && pastMeds.length > 0 && (
                        <SectionContainerCard
                            title="Finished"
                            subtitle="Medicines your child is no longer taking"
                        >
                            {pastMeds.slice(0, medsVisible).map((med) => (
                                <ListEntryCard
                                    key={med.id}
                                    thumbnailUrl={attachUrlFor("medication", med.id)}
                                    onThumbnailPress={() => openViewer("medication", med.id)}
                                    title={med.title}
                                    label={statusPill(true, "Finished")}
                                    subtitle={medicineSubtitle(med)}
                                    notes={med.instructions}
                                    icon={
                                        <Ionicons
                                            name="flask-outline"
                                            size={18}
                                            color={colors.recMedication.on}
                                        />
                                    }
                                    iconBg={colors.recMedication.bg}
                                    actions={
                                        <TouchableOpacity
                                            onPress={() => setMedicineForm({ record: med })}
                                            style={styles.rowEditBtn}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Edit ${med.title}`}
                                        >
                                            <Ionicons
                                                name="create-outline"
                                                size={16}
                                                color={colors.primary}
                                            />
                                        </TouchableOpacity>
                                    }
                                />
                            ))}
                            <ShowMore
                                total={pastMeds.length}
                                visible={medsVisible}
                                onPress={() => setMedsVisible((c) => c + 10)}
                                noun="medicines"
                            />
                        </SectionContainerCard>
                    )}
                </View>
            )}

            {/* TAB: ILLNESSES & ALLERGIES */}
            {activeTab === "illnesses" && (
                <View>
                    {/* Allergies Box */}
                    <SectionContainerCard
                        title="Allergies & Sensitivities"
                        subtitle="Active warnings & hereditary conditions"
                    >
                        <View style={styles.allergyInputRow}>
                            <TextInput
                                style={styles.inlineInput}
                                placeholder="Add new allergy target..."
                                placeholderTextColor={colors.placeholder}
                                value={newAllergy}
                                onChangeText={setNewAllergy}
                            />
                            <TouchableOpacity
                                onPress={handleAddAllergy}
                                style={styles.addInlineBtn}
                            >
                                <Text style={styles.addInlineBtnText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.allergyChips}>
                            {allergies.map((all, index) => (
                                <View key={index} style={styles.chip}>
                                    <Text style={styles.chipText} numberOfLines={2}>
                                        {all}
                                    </Text>
                                    {/* hitSlop, because the visible target is a
                                        14px glyph — about 14pt of tappable area
                                        inside a chip that is itself only ~26pt
                                        tall. The chip must stay small, so the
                                        touch area grows instead of the icon. */}
                                    <TouchableOpacity
                                        onPress={() =>
                                            persistAllergies(
                                                allergies.filter((_, i) => i !== index),
                                            )
                                        }
                                        hitSlop={{ top: 12, bottom: 12, left: 10, right: 14 }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remove allergy ${all}`}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={14}
                                            color={colors.danger}
                                            style={{ marginLeft: 4 }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {allergies.length === 0 && (
                                <Text style={{ ...type.caption, color: colors.textMuted }}>
                                    No allergies specified.
                                </Text>
                            )}
                        </View>
                    </SectionContainerCard>

                    {/* Active Illness Conditions */}
                    <SectionContainerCard
                        title="Illnesses & Conditions"
                        subtitle="Colds, fevers, and anything else your child has been through"
                        action={
                            <TouchableOpacity
                                onPress={() => setMedEvent({ kind: "illness", record: null })}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Log an illness"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {histLoading && <AppointmentsSkeleton count={3} />}
                        {!histLoading && illnesses.length === 0 && (
                            <EmptyStateCard message="Nothing recorded yet." icon="pulse-outline" />
                        )}
                        {!histLoading && illnesses.slice(0, illnessVisible).map((ill, idx) => (
                            <ListEntryCard
                                key={ill.id || idx}
                                thumbnailUrl={attachUrlFor("illness", ill.id)}
                                onThumbnailPress={() => openViewer("illness", ill.id)}
                                title={ill.title}
                                label={statusPill(ill.resolved, "Better")}
                                subtitle={medEventSubtitle(ill)}
                                notes={ill.desc}
                                icon={
                                    <Ionicons
                                        name="pulse-outline"
                                        size={18}
                                        color={colors.recIllness.on}
                                    />
                                }
                                iconBg={colors.recIllness.bg}
                                actions={
                                    <TouchableOpacity
                                        onPress={() => setMedEvent({ kind: "illness", record: ill })}
                                        style={styles.rowEditBtn}
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            ill.resolved
                                                ? `Edit ${ill.title}`
                                                : `Mark ${ill.title} better`
                                        }
                                    >
                                        <Ionicons
                                            name={ill.resolved ? "create-outline" : "checkmark-done"}
                                            size={16}
                                            color={colors.primary}
                                        />
                                    </TouchableOpacity>
                                }
                            />
                        ))}
                        {!histLoading && (
                            <ShowMore
                                total={illnesses.length}
                                visible={illnessVisible}
                                onPress={() => setIllnessVisible((c) => c + 10)}
                                noun="conditions"
                            />
                        )}
                    </SectionContainerCard>
                </View>
            )}

            {/* TAB: CHECKUPS */}
            {activeTab === "appointments" && (
                <View>
                    <SectionContainerCard
                        title="Clinical Consults & Appointments"
                        subtitle="Manage scheduled wellness checks and specialist visits"
                        action={
                            <TouchableOpacity
                                onPress={() => { resetAttach(); setShowApptModal(true); }}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add appointment"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {apptsLoading && <AppointmentsSkeleton count={3} />}
                        {!apptsLoading && appts.length === 0 && (
                            <EmptyStateCard message="No appointments scheduled yet." icon="calendar-outline" />
                        )}
                        {!apptsLoading && appts.slice(0, apptsVisible).map((appt, idx) => (
                            <ListEntryCard
                                key={appt.id || idx}
                                thumbnailUrl={attachUrlFor("checkup", appt.id)}
                                onThumbnailPress={() => openViewer("checkup", appt.id)}
                                title={appt.title}
                                // Was `2027-02-06 @ 09:00:00` — an ISO date
                                // and a time with seconds on it.
                                subtitle={[shortDate(appt.date), shortTime(appt.time)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                label={
                                    <Text
                                        style={{
                                            ...type.caption,
                                            color: colors.primary,
                                        }}
                                    >
                                        Doctor: {appt.provider}
                                    </Text>
                                }
                                notes={appt.notes}
                                icon={
                                    <Ionicons
                                        name="calendar-outline"
                                        size={18}
                                        color={colors.recCheckup.on}
                                    />
                                }
                                iconBg={colors.recCheckup.bg}
                            />
                        ))}
                        {!apptsLoading && (
                            <ShowMore
                                total={appts.length}
                                visible={apptsVisible}
                                onPress={() => setApptsVisible((c) => c + 10)}
                                noun="appointments"
                            />
                        )}
                    </SectionContainerCard>

                    <SectionContainerCard
                        title="Hospital Stays"
                        subtitle="Admissions, and how long each one lasted"
                        action={
                            <TouchableOpacity
                                onPress={() => setMedEvent({ kind: "hospitalization", record: null })}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Log a hospital stay"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {histLoading && <AppointmentsSkeleton count={2} />}
                        {!histLoading && hospitalizations.length === 0 && (
                            <EmptyStateCard message="No hospital stays recorded." icon="bandage-outline" />
                        )}
                        {!histLoading && hospitalizations.slice(0, hospVisible).map((h, idx) => (
                            <ListEntryCard
                                key={h.id || idx}
                                thumbnailUrl={attachUrlFor("hospitalization", h.id)}
                                onThumbnailPress={() => openViewer("hospitalization", h.id)}
                                title={h.title}
                                // This list showed no status at all, while the
                                // Dashboard ranked an unresolved stay as the
                                // single loudest alert in the app.
                                label={statusPill(h.resolved, "Discharged")}
                                subtitle={medEventSubtitle(h)}
                                notes={h.desc}
                                icon={
                                    <Ionicons name="bandage-outline" size={18} color={colors.recHospitalization.on} />
                                }
                                iconBg={colors.recHospitalization.bg}
                                actions={
                                    <TouchableOpacity
                                        onPress={() =>
                                            setMedEvent({ kind: "hospitalization", record: h })
                                        }
                                        style={styles.rowEditBtn}
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            h.resolved
                                                ? `Edit ${h.title}`
                                                : `Mark ${h.title} discharged`
                                        }
                                    >
                                        <Ionicons
                                            name={h.resolved ? "create-outline" : "checkmark-done"}
                                            size={16}
                                            color={colors.primary}
                                        />
                                    </TouchableOpacity>
                                }
                            />
                        ))}
                        {!histLoading && (
                            <ShowMore
                                total={hospitalizations.length}
                                visible={hospVisible}
                                onPress={() => setHospVisible((c) => c + 10)}
                                noun="hospitalizations"
                            />
                        )}
                    </SectionContainerCard>
                </View>
            )}

            {/* One form for illnesses and hospital stays — same record type,
                same bugs, so one implementation keeps them fixed together. */}
            <MedicalEventModal
                visible={!!medEvent}
                kind={medEvent ? medEvent.kind : "illness"}
                profile={profile}
                record={medEvent ? medEvent.record : null}
                previous={illnesses}
                onClose={() => setMedEvent(null)}
                onSaved={handleMedEventSaved}
            />

            <MedicineModal
                visible={!!medicineForm}
                profile={profile}
                record={medicineForm ? medicineForm.record : null}
                previousNames={previousMedNames}
                conditions={linkableConditions}
                onClose={() => setMedicineForm(null)}
                onSaved={handleMedicineSaved}
            />

            {/* Add Vaccine Modal */}
            <Modal visible={showVaxModal} transparent animationType="slide">
                <KeyboardAvoider>
                <View style={styles.modalBg}>
                    {/* This sheet had no ScrollView. Vaccine picker + dose chips
                        + date field + photo attach is taller than a 360x640
                        screen, so Save sat below the fold with no way to reach
                        it — the form could be filled in but not submitted. */}
                    <ScrollView
                        style={styles.modalSheet}
                        contentContainerStyle={styles.modalSheetContent}
                        keyboardShouldPersistTaps="handled"
                    >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Vaccination</Text>

                        {/* Picked from the DOH list, not typed. A blank box
                            asking a parent to name a vaccine is close to
                            unanswerable — and the app already holds the
                            canonical list the due dates come from. */}
                        <Text style={styles.modalLabel}>Vaccine</Text>
                        <TouchableOpacity
                            style={styles.pickerTrigger}
                            onPress={() => setVaxPickerOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel={
                                vaxName ? `Vaccine: ${vaxName}. Choose a different one` : "Choose a vaccine"
                            }
                        >
                            <Text style={[styles.pickerTriggerText, !vaxName && styles.pickerTriggerEmpty]}>
                                {vaxName || "Choose a vaccine"}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        {/* Revealed only when the parent picks "Something else",
                            so the free-text path still exists for a vaccine the
                            DOH list does not carry (a private-sector one, or a
                            dose given abroad) without being the default. */}
                        {vaxIsOther && (
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Vaccine name"
                                placeholderTextColor={colors.placeholder}
                                value={vaxOtherName}
                                onChangeText={setVaxOtherName}
                            />
                        )}

                        {vaxDoseOptions.length > 1 && (
                            <>
                                <Text style={styles.modalLabel}>Which dose</Text>
                                <View style={styles.doseRow}>
                                    {vaxDoseOptions.map((d) => {
                                        const on = vaxDose === d;
                                        return (
                                            <TouchableOpacity
                                                key={d}
                                                style={[styles.doseChip, on && styles.doseChipOn]}
                                                onPress={() => setVaxDose(d)}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: on }}
                                                accessibilityLabel={`Dose ${d}`}
                                            >
                                                <Text style={[styles.doseChipText, on && styles.doseChipTextOn]}>
                                                    {d}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        <DateField label="Due Date" value={vaxDue} onChange={setVaxDue} />

                        <PhotoAttach
                            required
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowVaxModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddVaccine}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("save")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    </ScrollView>
                </View>
                </KeyboardAvoider>
            </Modal>

            {/* New Appointment Modal */}
            <Modal visible={showApptModal} transparent animationType="slide">
                <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <ScrollView
                        style={styles.modalSheet}
                        contentContainerStyle={styles.modalSheetContent}
                        keyboardShouldPersistTaps="handled"
                    >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>New Appointment</Text>

                        <Text style={styles.modalLabel}>Appointment Title</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={apptTitle}
                            onChangeText={setApptTitle}
                        />

                        <Text style={styles.modalLabel}>
                            Pediatrician / Provider
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={apptDoctor}
                            onChangeText={setApptDoctor}
                        />

                        <View style={modalTwoCol ? styles.formRow : styles.formStack}>
                            <View style={modalTwoCol ? styles.formCell : styles.formCellFull}>
                                <Text style={styles.modalLabel}>Date</Text>
                                <DateField value={apptDate} onChange={setApptDate} />
                            </View>
                            <View style={modalTwoCol ? styles.formCell : styles.formCellFull}>
                                <Text style={styles.modalLabel}>Time</Text>
                                <TimeField value={apptTime} onChange={setApptTime} />
                            </View>
                        </View>

                        <Text style={styles.modalLabel}>
                            Clinic Guidelines / Notes
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={apptNotes}
                            onChangeText={setApptNotes}
                        />

                        <PhotoAttach
                            required
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowApptModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddAppointment}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    Schedule
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    </ScrollView>
                </View>
                </KeyboardAvoider>
            </Modal>

            <Modal visible={!!completeVaxTarget} transparent animationType="slide">
                <KeyboardAvoider>
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Mark Dose Given</Text>
                        <Text style={styles.modalLabel}>
                            {completeVaxTarget ? completeVaxTarget.vaccineName : ""}
                        </Text>

                        <ScrollView
                            style={[styles.modalScroll, { maxHeight: windowHeight * 0.5 }]}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Editable, not assumed. A parent recording a dose
                                a week after the clinic visit was previously
                                forced to file it as today's. */}
                            <DateField
                                label="Date given"
                                value={completeDate}
                                onChange={setCompleteDate}
                                maximumDate={todayLocal()}
                            />

                            <Text style={styles.modalLabel}>Any reaction afterwards?</Text>
                            <View style={styles.doseRow}>
                                {[
                                    { key: "none", label: "None" },
                                    { key: "mild", label: "Mild" },
                                    { key: "severe", label: "Severe" },
                                ].map((r) => {
                                    const on = completeReaction === r.key;
                                    return (
                                        <TouchableOpacity
                                            key={r.key}
                                            style={[styles.doseChip, on && styles.doseChipOn]}
                                            onPress={() => setCompleteReaction(r.key)}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={`Reaction: ${r.label}`}
                                        >
                                            <Text style={[styles.doseChipText, on && styles.doseChipTextOn]}>
                                                {r.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {completeReaction === "mild" || completeReaction === "severe" ? (
                                <>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="What happened?"
                                        placeholderTextColor={colors.placeholder}
                                        value={completeReactionNote}
                                        onChangeText={setCompleteReactionNote}
                                    />
                                    {/* States where a known allergy belongs
                                        without acting on it. Recording a
                                        reaction must never write to the
                                        child's allergies, warn, or say
                                        anything about a later dose —
                                        PRODUCT.md Principle 5. */}
                                    <View style={styles.noteBox}>
                                        <Ionicons
                                            name="information-circle-outline"
                                            size={15}
                                            color={colors.info}
                                        />
                                        <Text style={styles.noteText}>
                                            Kept with this dose so you can show it at the next visit. If
                                            this turns out to be a known allergy, you can add it to your
                                            child&apos;s profile.
                                        </Text>
                                    </View>
                                </>
                            ) : null}

                            <PhotoAttach
                                required
                                uri={completeAttachUri}
                                onChangeUri={setCompleteAttachUri}
                                label="Vaccination Card Photo"
                                helper="Required to confirm this dose was given"
                            />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setCompleteVaxTarget(null)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirmCompleteWithPhoto}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                </KeyboardAvoider>
            </Modal>

            {/* The DOH vaccine list. "Something else" sits first so a
                private-sector or overseas dose — the one case the list cannot
                cover — is the first thing a parent sees rather than something
                they scroll seventeen doses to find. */}
            <OptionSheet
                visible={vaxPickerOpen}
                title="Choose a vaccine"
                options={[
                    { key: OTHER_VACCINE, label: "Something else", note: "Type the name" },
                    ...vaccineOptions.map((o) => ({
                        key: o.key,
                        label: o.label,
                        note: o.doses > 1 ? `${o.doses} doses` : null,
                    })),
                ]}
                selectedKey={vaxName}
                onSelect={(key) => {
                    setVaxName(key);
                    setVaxPickerOpen(false);
                }}
                onClose={() => setVaxPickerOpen(false)}
            />

            <ImageViewer
                visible={!!viewer}
                uri={viewer ? viewer.uri : null}
                onClose={() => setViewer(null)}
                onReplace={replaceInViewer}
                onDelete={deleteInViewer}
            />
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    // Padding belongs on the CONTENT, not the ScrollView itself: padding on
    // the scroll view's own box does not scroll with the content, so the
    // bottom clearance that keeps the last card above the tab bar and the
    // floating button has to live here.
    content: {
        padding: space.lg,
    },
    careTeamBox: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: 12,
        marginBottom: 16,
    },
    careTeamHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    careTeamTitle: {
        ...type.caption,
        color: colors.primary,
        marginLeft: 6,
    },
    // Body, not caption: "Pediatrician: …" and "Hospital: …" are the card's
    // actual content, not a footnote about it, and 13px is the floor for
    // secondary text rather than a size for the thing you came to read.
    careTeamText: {
        ...type.body,
        color: colors.textSecondary,
        marginTop: 2,
    },
    careTeamHint: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: space.sm,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.xs,
        marginBottom: space.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabButton: {
        flex: 1,
        minWidth: 0,
        paddingVertical: space.sm + 2,
        // Zero, so the longest label ("Conditions") gets the button's full
        // share of the row. With 2px each side it was clipped by 2px at a
        // 326px viewport; the pill still has the container's padding outside.
        paddingHorizontal: 0,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    tabButtonActive: {
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    // Both states are the SAME size, differing only in weight and colour —
    // DESIGN.md's Weight Ladder Rule. The active style used to spread
    // type.label (14px) over an inactive type.caption (13px), so selecting a
    // tab grew its text, overflowed the flex:1 box, and clipped "Checkups".
    //
    // 13px rather than 14px because four labels have to share the row down to
    // a 320px screen, which PRODUCT.md treats as a real target ("assume the
    // worst device"). At 14px, "Conditions" truncates below ~360px wide.
    tabButtonText: {
        ...type.caption,
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primaryDark,
        fontWeight: "700",
    },
    vaxRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
    },
    vaxThumbWrap: {
        width: 42,
        height: 42,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        overflow: "hidden",
        marginLeft: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
    },
    vaxThumb: { width: "100%", height: "100%" },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.surface,
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    vaxTitle: {
        ...type.bodyStrong,
        color: colors.text,
    },
    vaxTitleCompleted: {
        textDecorationLine: "line-through",
        color: colors.textMuted,
    },
    vaxSub: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    // Coral, matching the Dashboard's Needs Attention rows — an overdue dose
    // reads the same wherever the parent meets it.
    vaxOverdue: {
        ...type.label,
        color: colors.danger,
        marginTop: 1,
    },
    vaxNotes: {
        ...type.caption,
        fontStyle: "italic",
        color: colors.primary,
        marginTop: 4,
    },
    bulletRow: {
        flexDirection: "row",
        marginBottom: 12,
        alignItems: "flex-start",
    },
    bulletTitle: {
        ...type.label,
        color: colors.text,
    },
    bulletDesc: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    // Sized by padding alone, this came out 40 x 30.4 — an icon-only button
    // needs its own minimum box, not whatever its glyph plus padding happens
    // to measure.
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        backgroundColor: colors.accentStrong,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    actionBtnText: {
        ...type.label,
        color: "#FFFFFF",
    },
    // Opens the record for editing — which is also how a parent says "this is
    // over now". A record that can never be corrected or closed is the reason
    // every past illness still read as happening.
    rowEditBtn: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.primarySoft,
    },
    statusPill: {
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderCurve: "continuous",
    },
    statusPillOpen: { backgroundColor: colors.warningBg },
    statusPillDone: { backgroundColor: colors.successBg },
    statusPillText: { ...type.caption, fontWeight: "700" },

    // ---- A running medicine course ----
    courseCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.md,
        marginBottom: space.sm,
    },
    courseHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
    listIconTile: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    courseTitle: { ...type.bodyStrong, color: colors.text },
    courseDetail: { ...type.caption, color: colors.textSecondary, marginTop: 3 },
    courseMeta: { ...type.caption, color: colors.textMuted, marginTop: 3 },
    courseThumbWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        overflow: "hidden",
    },
    courseThumb: { width: "100%", height: "100%" },

    doseRowWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space.sm,
        marginTop: space.md,
    },
    // An untaken slot is simply not filled. Never coral, never amber, never
    // labelled late — the app records doses, it does not grade the parent.
    doseSlot: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingHorizontal: space.md,
        minHeight: 34,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
    },
    doseSlotOn: { backgroundColor: colors.success, borderColor: colors.success },
    doseSlotText: { ...type.caption, color: colors.textSecondary },
    doseSlotTextOn: { color: colors.onPrimary, fontWeight: "700" },
    doseExtra: { ...type.caption, color: colors.textMuted },

    courseFoot: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
        marginTop: space.md,
    },
    courseFootStacked: { flexDirection: "column", alignItems: "flex-start" },
    courseNext: { ...type.caption, color: colors.textMuted, flex: 1, minWidth: 0, textAlign: "right" },
    courseNextStacked: { flex: 0, textAlign: "left", marginTop: space.sm },
    giveBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.accentStrong,
    },
    giveBtnText: { ...type.label, color: colors.onPrimary },
    exportPdfBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    exportPdfBtnText: {
        ...type.label,
        color: colors.primary,
    },
    actionBtnAlt: {
        backgroundColor: colors.softGreen,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionBtnAltText: {
        ...type.label,
        color: colors.primaryDark,
        marginLeft: 4,
    },
    // Sample-data banner for the stock bulletin. Teal (colors.info) rather
    // than amber: it is informational, not a warning about the child.
    sampleBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        backgroundColor: colors.infoBg,
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: space.sm,
        marginBottom: space.md,
    },
    sampleBannerText: { ...type.caption, color: colors.text, flex: 1 },

    // One row, four chips. They used to wrap, leaving "Overdue" stranded on a
    // line of its own — the labels are short enough to share a row once the
    // horizontal padding stops fighting them for space.
    filterRow: {
        flexDirection: "row",
        gap: space.sm,
        marginBottom: 10,
    },
    filterChip: {
        flex: 1,
        minWidth: 0,
        alignItems: "center",
        justifyContent: "center",
        // Zero horizontal padding, same reasoning as tabButton above: four
        // chips share the row, so at 360pt each gets ~67pt and "Overdue" at
        // 14px needed ~74pt including its padding. The pill's shape comes from
        // its vertical padding and radius, not from side padding it can't afford.
        paddingHorizontal: 0,
        minHeight: MIN_TOUCH,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    filterChipActive: {
        backgroundColor: colors.softGreen,
        borderColor: colors.primary,
    },
    // 13px, not 14 — see the note on tabButtonText. Both states are the same
    // size so selecting a chip can't grow its label past the box.
    filterChipText: {
        ...type.caption,
        fontWeight: "600",
        color: colors.textMuted,
    },
    filterChipTextActive: {
        color: colors.primaryDark,
    },
    visitGroupHeader: {
        ...type.subheading,
        color: colors.textMuted,
        marginTop: 12,
        marginBottom: 2,
    },
    epiChip: {
        backgroundColor: colors.recVaccine.bg,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        paddingHorizontal: 6,
        paddingVertical: 2,
        flexShrink: 0,
    },
    // No type-scale role fits a badge this small — type.subheading (14px)
    // overflows the chip. Deliberate literal exception, but raised from 9px:
    // three capitals at 9px is below anything legible on a real phone, and the
    // chip has room for 11 once its vertical padding goes from 1 to 2.
    epiChipText: {
        fontFamily: "PublicSans_700Bold",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.3,
        color: colors.recVaccine.on,
    },
    allergyInputRow: {
        flexDirection: "row",
        marginBottom: 12,
        gap: 8,
    },
    inlineInput: {
        flex: 1,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        height: 44,
        fontSize: type.body.fontSize,
        fontFamily: type.body.fontFamily,
        color: colors.text,
    },
    addInlineBtn: {
        paddingHorizontal: 16,
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
    },
    addInlineBtnText: {
        ...type.label,
        color: "#FFFFFF",
    },
    allergyChips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.dangerBg,
        borderWidth: 1,
        borderColor: colors.danger,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: radius.sm,
        borderCurve: "continuous",
    },
    chipText: {
        ...type.caption,
        color: colors.danger,
    },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    // The scroller that lets a tall sheet reach its own Save button.
    modalSheet: { width: "100%" },
    modalSheetContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
    modalCard: {
        backgroundColor: colors.background,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: 20,
        width: "100%",
        // 440, not 340 — at 340 the sheet was narrower than the phone under it
        // on every reference width, wasting room the fields needed.
        maxWidth: 440,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // Paired form fields; `formStack` is the same fields one per line.
    formRow: { flexDirection: "row", gap: space.sm },
    formStack: { flexDirection: "column" },
    formCell: { flex: 1, minWidth: 0 },
    formCellFull: { width: "100%" },
    modalTitle: {
        ...type.heading,
        color: colors.primary,
        marginBottom: 16,
    },
    modalLabel: {
        ...type.subheading,
        color: colors.textMuted,
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        height: 44,
        fontSize: type.body.fontSize,
        fontFamily: type.body.fontFamily,
        color: colors.text,
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
    },
    // The Mark Dose Given step now carries a date, a reaction and a photo, so
    // it scrolls rather than growing past the screen on a small phone.
    // maxHeight is applied inline as a fraction of the window — a hardcoded
    // 380 was taller than the usable area on a short phone and did not move
    // when the OS font scale grew the fields inside it.
    modalScroll: { flexGrow: 0 },

    // Opens the vaccine picker. Reads like an input so it is obviously a field,
    // not a button that navigates away.
    pickerTrigger: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        minHeight: MIN_TOUCH,
        marginBottom: 16,
    },
    pickerTriggerText: { ...type.body, color: colors.text, flex: 1 },
    pickerTriggerEmpty: { color: colors.placeholder },

    doseRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
    doseChip: {
        minWidth: 48,
        minHeight: MIN_TOUCH,
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    doseChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    doseChipText: { ...type.label, color: colors.textSecondary },
    doseChipTextOn: { color: colors.onPrimary },

    noteBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 12,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.infoBg,
        marginBottom: 16,
    },
    noteText: { flex: 1, ...type.caption, color: colors.text },

    // "What's next" band above the vaccine list.
    vaxSummary: { gap: 8, marginBottom: 16 },
    vaxSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
    },
    // Coral for a missed dose, which genuinely is overdue; teal for the next
    // visit, which is information rather than a warning.
    vaxSummaryOverdue: { backgroundColor: colors.surface, borderColor: colors.danger },
    vaxSummaryNext: { backgroundColor: colors.infoBg, borderColor: colors.border },
    vaxSummaryTitle: { ...type.bodyStrong, color: colors.text },
    vaxSummaryLine: { ...type.caption, color: colors.textSecondary, marginTop: 2 },

    reactionRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    reactionText: { ...type.caption, flex: 1 },
    modalCancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    modalCancelText: {
        ...type.caption,
        color: colors.textMuted,
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.accentStrong,
    },
    modalSaveText: {
        ...type.label,
        color: "#FFFFFF",
    },
});
