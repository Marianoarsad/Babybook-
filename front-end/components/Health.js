import IllnessesConditionsCard from "./ui/IllnessesConditionsCard";
import RecordIcon from "./ui/RecordIcon";
import VaccineIcon from "./ui/VaccineIcon";
import ImmunizationRecordsCard from "./ui/ImmunizationRecordsCard";
import { immunizationSummary, vaccinationInfo, isVaccinationDate } from "../utils/immunizationSummary";
import useVaccinationFocus, { vaccinationFocusId } from "../utils/useVaccinationFocus";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    useWindowDimensions,
    AppState,
} from "react-native";
import Modal from "./ui/AppModal";
import { api } from "../utils/api";
import { useRecords, useRecordCache, useConfirmedRecords, useScreenRefresh, useRecordOperations, useRecordSave } from "../utils/useRecords";
import { appointmentSummary, APPOINTMENT_STATUS_LABELS } from "../utils/appointmentSummary";
import ConsultationsAppointmentsCard from "./ui/ConsultationsAppointmentsCard";
import HospitalStaysCard from "./ui/HospitalStaysCard";
import HospitalStayIcon from "./ui/HospitalStayIcon";
import { hospitalStaySummary, hospitalStayInfo } from "../utils/hospitalStays";
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
    upcomingDoseSlots,
} from "../utils/medication";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { radius, space, type, shadow, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop, fitsColumns } from "../utils/responsive";
import {
    SectionContainerCard,
    EmptyStateCard,
} from "./common/Cards";
import PhotoAttach from "./ui/PhotoAttach";
import ShowMore from "./ui/ShowMore";
import AnimatedReveal from "./ui/AnimatedReveal";
import { AppointmentsSkeleton } from "./ui/Skeleton";
import PullToRefreshScrollView from "./ui/PullToRefreshScrollView";
import { DateField, TimeField } from "./ui/DateField";
import ImageViewer from "./ui/ImageViewer";
import OptionSheet from "./ui/OptionSheet";
import MedicalEventModal from "./ui/MedicalEventModal";
import MedicineModal from "./ui/MedicineModal";
import TipStrip from "./ui/TipStrip";
import MedicationIcon from "./ui/MedicationIcon";
import GlassFab from "./ui/GlassFab";
import Gradient from "./ui/Gradient";
import { MedicineSurface, MedicineDoseButton, DoseProgress, MedicineReminderBanner } from "./ui/MedicineVisuals";
import { medicationStatus } from "../utils/viewerRecords";
import NeumorphicTabs from "./ui/NeumorphicTabs";
import Field, { FieldShell } from "./ui/Field";

import RecordFormSheet, { DeleteConfirmation, RecordFormGroup, RecordFormRow } from "./ui/RecordFormSheet";
import PlanDetail from "./ui/PlanDetail";
import { shortDate, shortTime, todayLocal, nowLocalTime } from "../utils/dates";
import conditionRecords from "../utils/conditions.cjs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { CONDITION_CATEGORIES, conditionAttachmentType } = conditionRecords;

const HEALTH_TABS = [
    { key: "medications", label: "Medicine" },
    { key: "immunizations", label: "Vaccines" },
    { key: "appointments", label: "Checkups" },
    { key: "illnesses", label: "Conditions" },
];

// How the care level a parent picked reads back on the row. A record of what
// the family did, never a severity grade — "At home" is not "mild".
const CARE_LABELS = {
    home: "Cared for at home",
    doctor: "Saw a doctor",
    hospital: "Admitted to hospital",
};

function medicationLabel(med) {
    const status = medicationStatus({ resolved: med.resolved, date_recorded: med.date, course_days: med.courseDays }, todayLocal());
    return status === "completed" ? "Finished" : status === "taking" ? "Taking now" : status;
}

function MedicineCourseCard({ med, doses, onOpen, onGive, busyAction }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [footWidth, setFootWidth] = useState(0);
    const [buttonWidth, setButtonWidth] = useState(0);
    const [countWidth, setCountWidth] = useState(0);
    const footTwoCol = buttonWidth > 0 && countWidth > 0 && footWidth >= buttonWidth + space.lg + 30 + space.sm + countWidth;
    const times = doseTimesOf(med);
    const detail = [med.frequencyPerDay ? med.frequencyPerDay + (med.frequencyPerDay === 1 ? " time a day" : " times a day") : "",
        courseDayText(med.date, med.courseDays, todayLocal())].filter(Boolean).join(" · ");
    return <View style={styles.medicineItem}>
        <MedicineSurface item radius={24} />
        <TouchableOpacity style={styles.courseHead} onPress={onOpen} accessibilityRole="button" accessibilityLabel={"View " + med.title + " details"}>
            <MedicationIcon record={med} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.courseTitle}>{med.title}</Text>
                {detail ? <Text style={styles.courseDetail}>{detail}</Text> : null}
            </View>
        </TouchableOpacity>
        <View onLayout={event => setFootWidth(event.nativeEvent.layout.width)}
            style={[styles.courseFoot, !footTwoCol && styles.courseFootStacked]}>
            {times.length ? <MedicineDoseButton onLayout={event => setButtonWidth(event.nativeEvent.layout.width)} onPress={onGive} disabled={!!busyAction} label={"Record a dose of " + med.title} /> : null}
            <DoseProgress onCountLayout={event => setCountWidth(event.nativeEvent.layout.width)} given={doses.length} scheduled={times.length} />
        </View>
    </View>;
}

export default function Health({
    profile,
    onUpdateProfile,
    immunizations,
    setImmunizations,
    initialTab,
    initialRecord,
    navKey,
}) {
    const { t } = useLanguage();
    const toast = useToast();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    // Room inside a modal sheet: screen, less the backdrop padding, capped at
    // the card's maxWidth, less the card's own padding. Paired fields (Date /
    // Time) drop to one per line when that can't give each a readable column.
    const { width: windowWidth } = useWindowDimensions();
    const modalTwoCol = fitsColumns(Math.min(windowWidth - 40, 440) - 40, 2, space.sm);
    // Defaults to the LEFTMOST tab. Landing on a tab that is not the first one
    // reads as a bug — people assume the highlight is wrong — so this has to be
    // kept in step with the tab bar's order below if that order ever changes.
    const [activeTab, setActiveTab] = useState("medications");
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
        if (initialRecord?.intent === "focus") {
            setActiveTab("immunizations");
            if (!vaccinationFocusId(initialRecord, profile.id)) toast.error("This vaccination is not available for the selected baby.");
            return;
        }
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
            const raw = initialRecord?.record;
            const open = raw && initialRecord.sourceType === "vaccination"
                ? () => {
                      const record = vaccinationToApp(raw);
                      const base = String(record.vaccineName || "").replace(/\s+\d+$/, "").trim();
                      setEditingVaccine(record);
                      setVaxName(base);
                      setVaxOtherName("");
                      setVaxDose(record.doseNumber || 1);
                      setVaxDue(record.dueDate || "");
                      setShowVaxModal(true);
                  }
                : raw && initialRecord.sourceType === "checkup"
                  ? () => {
                        const record = checkupToApp(raw);
                        setEditingAppointment(record);
                        setApptTitle(record.title || "");
                        setApptDoctor(record.provider || "");
                        setApptDate(record.date || todayLocal());
                        setApptTime(String(record.time || "").slice(0, 5));
                        setApptNotes(record.notes || "");
                        setShowApptModal(true);
                    }
                  : raw && initialRecord.sourceType === "medical-history"
                    ? () => {
                          if (raw.category === "Medication") setMedicineForm({ record: medHistoryToMed(raw) });
                          else setMedEvent({
                              kind: raw.category === "Hospitalization" ? "hospitalization" : "illness",
                              record: medHistoryToIllness(raw),
                          });
                      }
                    : modalFor[initialTab];
            if (open) {
                resetAttach();
                open();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    // Vaccinations now load from and persist to the backend.
    const vaccinationRows = useConfirmedRecords(profile.id, "vaccinations");
    const vaccinationCache = useRecordCache(profile.id, "vaccinations");
    const vaccines = useMemo(() => vaccinationRows.map(vaccinationToApp), [vaccinationRows]);
    const [vaxLoading, setVaxLoading] = useState(true);
    const refreshGuard = useRef(() => false);
    const currentChild = useRef(profile.id); currentChild.current = profile.id;
    const loadVaccines = useCallback(async (isCurrent = refreshGuard.current) => {
        if (!isCurrent() || currentChild.current !== profile.id) return [];
        setVaxLoading(true);
        try {
            await api.listRecords(profile.id, "vaccinations", { loading: "nonblocking" });
            return [];
        } catch (_) {
            return ["vaccinations"];
        } finally {
            if (isCurrent() && currentChild.current === profile.id) setVaxLoading(false);
        }
    }, [profile.id]);

    // Checkups now load from and persist to the backend.
    const checkupRows = useRecords(profile.id, "checkups");
    const planStatuses = useRecords(profile.id, "calendar-plan-statuses");
    const checkupCache = useRecordCache(profile.id, "checkups");
    const planCache = useRecordCache(profile.id, "calendar-plan-statuses");
    const [apptsLoading, setApptsLoading] = useState(true);
    const [appointmentDay, setAppointmentDay] = useState(todayLocal);
    useEffect(() => {
        const update = () => setAppointmentDay(todayLocal());
        const timer = setInterval(update, 60000);
        const subscription = AppState.addEventListener("change", state => { if (state === "active") update(); });
        return () => { clearInterval(timer); subscription.remove(); };
    }, []);
    const appointmentData = useMemo(() => appointmentSummary(checkupRows, planStatuses, appointmentDay),
        [checkupRows, planStatuses, appointmentDay]);
    const appts = appointmentData.appointments;
    const appointmentsReady = checkupCache.hasFetched && planCache.hasFetched;
    const loadAppts = useCallback(async (isCurrent = refreshGuard.current) => {
        if (!isCurrent() || currentChild.current !== profile.id) return [];
        setApptsLoading(true);
        try {
            const resources = ["checkups", "calendar-plan-statuses"];
            const results = await Promise.allSettled(resources.map(resource => api.listRecords(profile.id, resource, { loading: "nonblocking" })));
            return resources.filter((_, index) => results[index].status === "rejected");
        } finally {
            if (isCurrent() && currentChild.current === profile.id) setApptsLoading(false);
        }
    }, [profile.id]);

    const vaccineSummary = useMemo(() => immunizationSummary(vaccines, appointmentDay), [vaccines, appointmentDay]);

    // Old profiles stored allergies and hereditary conditions as child-level
    // string arrays. Keep those facts visible beside detailed medical-history
    // rows until the parent edits or deletes them; a detailed row wins when
    // both stores contain the same category/title.
    const [legacyFacts, setLegacyFacts] = useState({ child: profile.id, allergies: profile.allergies || [], hereditary: profile.hereditaryConditions || [] });
    const legacyAllergies = legacyFacts.child === profile.id ? legacyFacts.allergies : profile.allergies || [];
    const legacyHereditary = legacyFacts.child === profile.id ? legacyFacts.hereditary : profile.hereditaryConditions || [];
    const [legacyBusy, setLegacyBusy] = useState(false);
    useEffect(() => {
        setLegacyFacts({ child: profile.id, allergies: profile.allergies || [], hereditary: profile.hereditaryConditions || [] });
    }, [profile.id, profile.allergies, profile.hereditaryConditions]);

    const persistLegacyFacts = async (category, updated) => {
        if (legacyBusy) return false;
        const hereditary = category === "Hereditary Condition";
        setLegacyBusy(true);
        try {
            const saved = await api.updateChild(profile.id, hereditary
                ? { hereditary_conditions: updated }
                : { allergies: updated });
            const values = hereditary ? saved.hereditary_conditions || updated : saved.allergies || updated;
            setLegacyFacts({ child: profile.id, allergies: hereditary ? legacyAllergies : values, hereditary: hereditary ? values : legacyHereditary });
            onUpdateProfile({ id: profile.id, [hereditary ? "hereditaryConditions" : "allergies"]: values });
            return true;
        } finally {
            setLegacyBusy(false);
        }
    };

    const removeLegacyFact = async (record) => {
        if (!record || !["Allergy", "Hereditary Condition"].includes(record.category)) return true;
        const source = record.category === "Allergy" ? legacyAllergies : legacyHereditary;
        const title = String(record.title || "").trim().toLocaleLowerCase();
        const updated = source.filter((item) => String(item || "").trim().toLocaleLowerCase() !== title);
        return updated.length === source.length || persistLegacyFacts(record.category, updated);
    };

    const [medications, setMedications] = useState([]);
    const [medsVisible, setMedsVisible] = useState(10);
    // { record } | null — absent record means "add". Same shape as medEvent.
    const [medicineForm, setMedicineForm] = useState(null);
    // One row per dose actually given, across every medicine for this child.
    const doseRows = useConfirmedRecords(profile.id, "medication-doses");
    const doses = useMemo(() => doseRows.map(medicationDoseToApp), [doseRows]);
    const recordOperations = useRecordOperations();

    const medicalHistoryRows = useRecords(profile.id, "medical-history");
    const medicalHistoryCache = useRecordCache(profile.id, "medical-history");
    const conditions = useMemo(() => medicalHistoryRows.filter(record => CONDITION_CATEGORIES.includes(record.category)).map(record => ({ ...medHistoryToIllness(record), resolved: record.resolved })), [medicalHistoryRows]);
    const conditionSummary = useMemo(() => conditionRecords.conditionsSummary(conditions, legacyAllergies, legacyHereditary), [conditions, legacyAllergies, legacyHereditary]);
    const mergedConditions = conditionSummary.records;
    const hospitalSummary = useMemo(() => hospitalStaySummary(medicalHistoryRows, appointmentDay), [medicalHistoryRows, appointmentDay]);
    const hospitalizations = hospitalSummary.stays;

    // Illnesses and hospital stays share one form (ui/MedicalEventModal.js).
    // `record` absent means add; present means edit — and edit is what makes
    // "this is over now" sayable at all. Nothing in the app could set
    // `resolved` before, so every past illness claimed to still be happening
    // on the Dashboard and in the healthcare professional's view.
    const [medEvent, setMedEvent] = useState(null); // { kind, record } | null

    const handleMedEventSaved = async (saved, kind) => {
        if (kind === "illness") {
            const previous = medEvent?.record;
            if (previous && !(await removeLegacyFact(previous))) {
                throw new Error("The record was saved, but the old profile fact could not be removed. Retry to finish.");
            }
        }
        // A newly attached photo is not in attachMap yet, and an edit may have
        // replaced the old one. Cheaper and more honest than guessing.
        loadAttachments();
    };

    const conditionMeta = (record) => {
        if (record.category === "Allergy") {
            return { label: "Allergy information", icon: "alert-circle-outline", tone: colors.conditionCategory.allergy };
        }
        if (record.category === "Hereditary Condition") {
            return { label: "Hereditary", icon: "pulse-outline", tone: colors.conditionCategory.hereditary };
        }
        return { label: "Illness", icon: "thermometer-outline", tone: colors.conditionCategory.illness };
    };

    const conditionStatus = conditionRecords.conditionSavedStatus;

    // Amber while it is still going, green once it is over. DESIGN.md reserves
    // coral for overdue / error / destructive, and something a child is still
    // getting over is none of those. The word carries the state as well as the
    // colour, so it never rests on hue alone.
    // The illness a medicine is linked to, by id. Illnesses and hospital stays
    // are both offered, since a medicine can follow either.
    const linkableConditions = useMemo(
        () => [...conditions.filter((record) => record.category === "Illness"), ...hospitalizations],
        [conditions, hospitalizations],
    );
    const conditionTitle = (id) => {
        if (!id) return "";
        const hit = linkableConditions.find((c) => String(c.id) === String(id));
        return hit ? hit.title : "";
    };

    // A finished course, in one line: how long it ran and what it was for.


    // Appointment (checkup) adding state
    const [showApptModal, setShowApptModal] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);
    const saveAppointment = useRecordSave(showApptModal, profile?.id, "checkups", editingAppointment?.id);
    const saveAppointmentReminder = useRecordSave(showApptModal, profile?.id, "reminders");
    const [detailHealthRecord, setDetailHealthRecord] = useState(null); // { kind, record }
    const [healthDeleteCandidate, setHealthDeleteCandidate] = useState(null);
    const [deletingHealthRecord, setDeletingHealthRecord] = useState(false);
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
    const [addingAppointment, setAddingAppointment] = useState(false);

    // Medical history (illnesses + medications) loads from the backend.
    const [histLoading, setHistLoading] = useState(true);
    const loadMedHistory = useCallback(async (isCurrent = refreshGuard.current) => {
        if (!isCurrent() || currentChild.current !== profile.id) return [];
        setHistLoading(true);
        try {
            const rows = await api.listRecords(profile.id, "medical-history", { loading: "nonblocking" });
            if (isCurrent() && currentChild.current === profile.id) {
                setMedications(rows.filter((r) => r.category === "Medication").map(medHistoryToMed));
            }
            return [];
        } catch (_) {
            return ["medical-history"];
        } finally {
            if (isCurrent() && currentChild.current === profile.id) setHistLoading(false);
        }
    }, [profile.id]);

    // Every dose given, for every medicine. Small rows, and the Medicine tab
    // needs today's count for each active course, so one request beats one per
    // medicine (PRODUCT.md Principle 3 — assume the worst connection).
    const loadDoses = useCallback(async (isCurrent = refreshGuard.current) => {
        if (!isCurrent() || currentChild.current !== profile.id) return [];
        try {
            await api.listRecords(profile.id, "medication-doses", { loading: "nonblocking" });
            return [];
        } catch (_) {
            return ["medication-doses"];
        }
    }, [profile.id]);

    // ===== Mandatory supporting-photo attachments =====
    const [attachUri, setAttachUri] = useState("");
    const [attachMap, setAttachMap] = useState({}); // `${type}:${id}` -> attachment row
    const [viewer, setViewer] = useState(null); // { uri, type, recordId, attachId }
    const [attachmentAction, setAttachmentAction] = useState(null);

    const [attachLoading, setAttachLoading] = useState(true);
    const loadAttachments = useCallback(async (isCurrent = refreshGuard.current) => {
        if (!isCurrent() || currentChild.current !== profile.id) return [];
        setAttachLoading(true);
        try {
            const rows = await api.listAttachments(profile.id, { loading: "nonblocking" });
            const map = {};
            for (const a of rows) map[`${a.record_type}:${a.record_id}`] = a;
            if (isCurrent() && currentChild.current === profile.id) setAttachMap(map);
            return [];
        } catch (_) {
            return ["attachments"];
        } finally {
            if (isCurrent() && currentChild.current === profile.id) setAttachLoading(false);
        }
    }, [profile.id]);
    const loadHealth = useCallback(async (isCurrent) => {
        const failures = await Promise.all([
            loadVaccines(isCurrent), loadAppts(isCurrent), loadMedHistory(isCurrent),
            loadDoses(isCurrent), loadAttachments(isCurrent),
        ]);
        return failures.flat();
    }, [loadVaccines, loadAppts, loadMedHistory, loadDoses, loadAttachments]);
    const { refreshing: healthRefreshing, failures: refreshFailures, refresh: refreshHealth, isActive } =
        useScreenRefresh(profile.id, loadHealth);
    refreshGuard.current = isActive;
    const listLoading = healthRefreshing || vaxLoading || apptsLoading || histLoading || attachLoading;
    const healthScrollRef = useRef(null);
    const vaccineFocus = useVaccinationFocus({ request: initialRecord, navKey, childId: profile.id,
        records: vaccineSummary.records, ready: vaccinationCache.hasFetched && !vaxLoading && !healthRefreshing && !refreshFailures.includes("vaccinations"),
        active: activeTab === "immunizations", scrollRef: healthScrollRef, topInset: padTop,
        onMissing: () => toast.error("This vaccination is no longer available.") });

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
            throw new Error(`Record saved, but its photo could not be saved: ${e.message}. Retry to finish this record.`);
        }
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
        if (!viewer || attachmentAction || !pickerAvailable()) return;
        const uri = await pickImage();
        if (!uri) return;
        setAttachmentAction("replace");
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
        } finally {
            setAttachmentAction(null);
        }
    };
    const deleteInViewer = async () => {
        if (!viewer || attachmentAction) return;
        setAttachmentAction("delete");
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
        } finally {
            setAttachmentAction(null);
        }
    };

    const openAppointmentEditor = (record = null) => {
        resetAttach();
        setEditingAppointment(record);
        setApptTitle(record?.title || "");
        setApptDoctor(record?.provider || "");
        setApptDate(record?.date || todayLocal());
        setApptTime(String(record?.time || "").slice(0, 5));
        setApptNotes(record?.notes || "");
        setDetailHealthRecord(null);
        setShowApptModal(true);
    };

    // Add-vaccine modal state.
    const OTHER_VACCINE = "__other__";
    const [showVaxModal, setShowVaxModal] = useState(false);
    const [editingVaccine, setEditingVaccine] = useState(null);
    const saveVaccine = useRecordSave(showVaxModal, profile?.id, "vaccinations", editingVaccine?.id);
    const saveVaccineReminder = useRecordSave(showVaxModal, profile?.id, "reminders");
    const [vaxName, setVaxName] = useState("");
    const [vaxOtherName, setVaxOtherName] = useState("");
    const [vaxDose, setVaxDose] = useState(1);
    const [vaxDue, setVaxDue] = useState("");
    const [vaxDueError, setVaxDueError] = useState("");
    const [vaxPickerOpen, setVaxPickerOpen] = useState(false);
    const [vaxPickerAnchor, setVaxPickerAnchor] = useState(null);
    const vaxPickerRef = useRef(null);
    const [addingVaccine, setAddingVaccine] = useState(false);

    // The DOH vaccine list, fetched once. Falls back to the names already in
    // this child's own records if the request fails, so an offline parent can
    // still pick rather than type — and never to a hard-coded copy of the
    // schedule, which would drift from the one generating their due dates.
    const [catalogue, setCatalogue] = useState([]);
    useEffect(() => {
        let active = true;
        api.vaccineCatalogue({ loading: "nonblocking" })
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
        if (!vaxName || vaxIsOther || editingVaccine) return;
        const taken = new Set(
            vaccines
                .filter((v) => String(v.vaccineName || "").replace(/\s+\d+$/, "").trim() === vaxName)
                .map((v) => v.doseNumber)
                .filter(Boolean),
        );
        const next = vaxDoseOptions.find((d) => !taken.has(d));
        setVaxDose(next || vaxDoseOptions[0] || 1);
    }, [vaxName, vaccines, vaxDoseOptions, vaxIsOther, editingVaccine]);

    const resetVaxForm = () => {
        setEditingVaccine(null);
        setVaxName("");
        setVaxOtherName("");
        setVaxDose(1);
        setVaxDue("");
        setVaxDueError("");
    };

    const openVaccineEditor = (record = null) => {
        resetAttach();
        setVaxDueError("");
        if (!record) {
            resetVaxForm();
        } else {
            const base = String(record.vaccineName || "").replace(/\s+\d+$/, "").trim();
            setEditingVaccine(record);
            setVaxName(base);
            setVaxOtherName("");
            setVaxDose(record.doseNumber || 1);
            setVaxDue(record.dueDate || "");
        }
        setShowVaxModal(true);
    };

    const handleAddVaccine = async () => {
        if (addingVaccine) return;
        if ((!editingVaccine?.isCompleted || vaxDue) && !isVaccinationDate(vaxDue)) {
            setVaxDueError("Choose a valid due date for this vaccination.");
            return;
        }
        const picked = vaxIsOther ? vaxOtherName.trim() : vaxName;
        if (!picked) {
            toast.error(vaxIsOther ? "Please enter a vaccine name" : "Please choose a vaccine");
            return;
        }
        const multiDose = !vaxIsOther && (vaxDoseOptions.length > 1 || !!editingVaccine?.doseNumber);
        // The dose stays in the name as well as its own column: every existing
        // row is named this way, and the dedupe that stops the DOH generator
        // duplicating doses compares on that name.
        const name = multiDose ? `${picked} ${vaxDose}` : picked;
        const dose = multiDose ? vaxDose : null;
        const due = vaxDue;
        setAddingVaccine(true);
        try {
            const body = {
                vaccine_name: name,
                due_date: due || null,
                dose_number: dose,
                ...(editingVaccine ? {} : { visit_name: null, status: "scheduled" }),
            };
            const saved = await saveVaccine(body);
            if (attachUri) await uploadAttachFor("vaccination", saved.id);
            // Set a reminder for the due date: notification + backend record.
            const when = morningOf(due);
            if (when && !editingVaccine) {
                await saveVaccineReminder({
                        reminder_type: "Vaccination",
                        title: name,
                        reminder_date: due,
                        status: "Pending",
                        vaccination_id: saved.id,
                    });
                await scheduleReminder("Vaccination reminder", `${name} due`, when);
            }
            setShowVaxModal(false);
            resetVaxForm();
        } catch (e) {
            toast.error(e.message || `Could not ${editingVaccine ? "update" : "add"} vaccine`);
        } finally {
            setAddingVaccine(false);
        }
    };

    // `given` is the date the dose was ACTUALLY administered, not the date the
    // parent got round to recording it. This used to be hard-coded to today,
    // so a dose given last week was filed as today's — and date_given is
    // exactly what the professional portal shows a clinician.
    const applyVaccineToggle = async (vax, nowCompleted, extra = {}) => {
        await api.updateRecord(profile.id, "vaccinations", vax.id, {
            status: nowCompleted ? "completed" : "scheduled",
            date_given: nowCompleted ? extra.dateGiven || todayLocal() : null,
            reaction_severity: nowCompleted ? extra.reactionSeverity || null : null,
            reaction: nowCompleted && extra.reactionSeverity && extra.reactionSeverity !== "none" ? extra.reaction || null : null,
        });
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
    const [vaccineBusyId, setVaccineBusyId] = useState(null);
    const [completingVaccine, setCompletingVaccine] = useState(false);

    const handleToggleVaccine = async (id) => {
        if (vaccineBusyId !== null) return;
        const vax = vaccines.find((v) => v.id === id);
        if (!vax) return;
        const nowCompleted = !vax.isCompleted;
        if (!nowCompleted && !isVaccinationDate(vax.dueDate)) {
            toast.error("Add a valid due date in Edit Vaccination before undoing this dose.");
            return;
        }
        if (nowCompleted) {
            setCompleteAttachUri("");
            setCompleteDate(todayLocal());
            setCompleteReaction("");
            setCompleteReactionNote("");
            setCompleteVaxTarget(vax);
            return;
        }
        setVaccineBusyId(id);
        try {
            await applyVaccineToggle(vax, false);
        } catch (e) {
            toast.error(e.message || "Could not update vaccination");
        } finally {
            setVaccineBusyId(null);
        }
    };

    const handleConfirmCompleteWithPhoto = async () => {
        if (completingVaccine) return;
        const alreadyAttached = !!attachUrlFor("vaccination", completeVaxTarget?.id);
        if (!completeAttachUri && !alreadyAttached) {
            toast.error("A supporting photo is required to mark this dose given."); return;
        }
        const vax = completeVaxTarget;
        setCompletingVaccine(true);
        try {
            // Upload required evidence FIRST. A failed upload must not mark the dose given.
            if (completeAttachUri) {
                const a = await api.uploadAttachment(profile.id, { recordType: "vaccination", recordId: vax.id, photoUri: completeAttachUri });
                setAttachMap((prev) => ({ ...prev, [`vaccination:${vax.id}`]: a }));
                setCompleteAttachUri("");
            }
            await applyVaccineToggle(vax, true, { dateGiven: completeDate, reactionSeverity: completeReaction, reaction: completeReactionNote });
            setCompleteVaxTarget(null);
        } catch (e) { toast.error(e.message || "Could not complete vaccination. Your inputs have been retained."); }
        finally { setCompletingVaccine(false); }
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
                await api.listRecords(profile.id, "vaccinations", { loading: "nonblocking" });
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

    // Courses running today, and the ones already done.
    const activeMeds = useMemo(
        () => medications.filter((m) => isActiveOn(m, todayLocal())),
        [medications],
    );
    const finishedMeds = useMemo(
        () => medications.filter((m) => m.resolved === true),
        [medications],
    );
    const otherMeds = useMemo(() => medications.filter(m => m.resolved !== true && !isActiveOn(m, todayLocal())), [medications]);
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
            wasEdit ? prev.map((m) => (m.id === saved.id ? saved : m)) : [saved, ...prev.filter((m) => m.id !== saved.id)],
        );
        loadAttachments();
    };

    // Record a dose as given, now. Optimistic: a parent standing over a child
    // with a syringe should see the slot fill immediately, not after a round
    // trip on clinic wifi. Rolled back if the write fails.
    const handleGiveDose = async (med) => {
        try {
            await api.optimisticRecord(profile.id, "medication-doses", "create", null,
                { medication_id: Number(med.id), given_date: todayLocal(), given_time: nowLocalTime() },
                { entity: `med:${med.id}`, label: "Dose record" });
        } catch (e) { toast.error(e.message || "Could not save the dose record"); }
    };

    const handleUndoDose = async (dose) => {
        try {
            await api.optimisticRecord(profile.id, "medication-doses", "delete", dose.id, {},
                { entity: `med:${dose.medicationId}`, label: "Undo dose record" });
        } catch (e) { toast.error(e.message || "Could not undo the dose record"); }
    };

    const handleAddAppointment = async () => {
        if (addingAppointment) return;
        if (!apptTitle || !apptDoctor || !apptDate) {
            toast.error("Please fill out required fields");
            return;
        }
        if (!editingAppointment && !requireAttach()) return;
        setAddingAppointment(true);
        // Persist as a checkup (also feeds the QR consultation snapshot).
        try {
            const body = {
                title: apptTitle,
                doctor_name: apptDoctor,
                checkup_date: apptDate,
                time_of_visit: apptTime || null,
                notes: apptNotes || null,
                ...(editingAppointment ? {} : { status: "scheduled" }),
            };
            const saved = await saveAppointment(body);
            if (attachUri) await uploadAttachFor("checkup", saved.id);
            // Set a reminder: local notification + backend reminder record.
            const when = morningOf(apptDate);
            if (when && !editingAppointment) {
                await saveAppointmentReminder({
                        reminder_type: "Checkup",
                        title: apptTitle,
                        reminder_date: apptDate,
                        status: "Pending",
                        checkup_id: saved.id,
                    });
                await scheduleReminder("Checkup reminder", `${apptTitle} with ${apptDoctor}`, when);
            }
            setShowApptModal(false);
            resetAttach();
            toast.success(editingAppointment ? "Appointment updated." : "Pediatric session scheduled successfully.");
            setEditingAppointment(null);
        } catch (e) {
            toast.error(e.message || "Could not save appointment");
        } finally {
            setAddingAppointment(false);
        }
    };

    const deleteHealthRecord = async (candidate = null) => {
        const target = candidate?.record ? candidate : healthDeleteCandidate;
        if (!target || deletingHealthRecord) return false;
        const { kind, record } = target;
        const condition = kind === "illness";
        const medication = kind === "medication";
        const hospitalization = kind === "hospitalization";
        const vaccination = kind === "vaccination";
        const medicalHistory = condition || medication || hospitalization;
        const conditionLabel = record.category === "Hereditary Condition" ? "Hereditary condition" : record.category || "Illness";
        const recordLabel = vaccination ? "Vaccination" : medication ? "Medicine" : hospitalization ? "Hospital stay" : condition ? `${conditionLabel} record` : "Appointment";
        setDeletingHealthRecord(true);
        try {
            if (condition && !(await removeLegacyFact(record))) return false;
            if (!record.legacy) {
                await api.deleteRecord(profile.id, vaccination ? "vaccinations" : medicalHistory ? "medical-history" : "checkups", record.id);
            }
            if (medication) setMedications(prev => prev.filter(item => item.id !== record.id));
            setAttachMap((prev) => {
                const next = { ...prev };
                const attachmentType = vaccination
                    ? "vaccination"
                    : medication
                      ? "medication"
                      : hospitalization
                        ? "hospitalization"
                      : condition
                        ? conditionAttachmentType(record.category)
                        : "checkup";
                delete next[`${attachmentType}:${record.id}`];
                return next;
            });
            setHealthDeleteCandidate(null);
            setDetailHealthRecord(null);
            toast.success(`${recordLabel} deleted`);
            return true;
        } catch (e) {
            toast.error(e.message || `Could not delete ${recordLabel.toLowerCase()}`);
            return false;
        } finally {
            setDeletingHealthRecord(false);
        }
    };

    const selectedHealthRecord = detailHealthRecord?.kind === "vaccination"
        ? vaccines.find(vaccine => vaccine.id === detailHealthRecord.record.id) || detailHealthRecord.record
        : detailHealthRecord?.kind === "medication"
        ? medications.find(m => m.id === detailHealthRecord.record.id) || detailHealthRecord.record
        : detailHealthRecord?.kind === "checkup"
        ? appts.find(appt => appt.id === detailHealthRecord.record.id) || detailHealthRecord.record
        : detailHealthRecord?.kind === "hospitalization"
        ? hospitalizations.find(stay => stay.id === detailHealthRecord.record.id) || detailHealthRecord.record
        : detailHealthRecord?.kind === "illness"
        ? mergedConditions.find(record => record.id === detailHealthRecord.record.id) || detailHealthRecord.record
        : detailHealthRecord?.record;
    const selectedIsVaccination = detailHealthRecord?.kind === "vaccination";
    const selectedVaccineInfo = selectedIsVaccination && selectedHealthRecord ? vaccinationInfo(selectedHealthRecord, appointmentDay) : null;
    const selectedIsCondition = detailHealthRecord?.kind === "illness";
    const selectedIsMedication = detailHealthRecord?.kind === "medication";
    const selectedIsHospitalization = detailHealthRecord?.kind === "hospitalization";
    const selectedConditionMeta = selectedIsCondition && selectedHealthRecord ? conditionMeta(selectedHealthRecord) : null;
    const healthDetailPlan = selectedHealthRecord ? {
        ...selectedHealthRecord,
        title: selectedIsVaccination ? selectedHealthRecord.vaccineName : selectedHealthRecord.title,
        categoryLabel: selectedIsVaccination ? "Vaccination" : selectedIsMedication ? "Medicine" : selectedIsHospitalization ? "Hospital stay" : selectedIsCondition ? selectedConditionMeta.label : "Checkup",
        color: selectedIsVaccination ? colors.recVaccine.on : selectedIsMedication
            ? colors.recMedication.on
            : selectedIsHospitalization
              ? colors.recHospitalization.on
              : selectedIsCondition ? selectedConditionMeta.tone.on : colors.recCheckup.on,
        status: selectedIsVaccination ? selectedVaccineInfo.statusLabel : selectedIsMedication
            ? medicationLabel(selectedHealthRecord)
            : selectedIsHospitalization
            ? hospitalStayInfo(selectedHealthRecord, appointmentDay).statusLabel
            : selectedIsCondition
            ? selectedHealthRecord.category === "Allergy" ? undefined : conditionStatus(selectedHealthRecord)
            : selectedHealthRecord.isCompleted
              ? "Done"
              : selectedHealthRecord.date < todayLocal() ? "Overdue" : "Scheduled",
        details: selectedIsVaccination
            ? [
                  { label: "Scheduled date", value: selectedHealthRecord.dueDate ? shortDate(selectedHealthRecord.dueDate) || "Date not recorded" : "Date not recorded" },
                  selectedHealthRecord.isCompleted ? { label: "Administration", value: selectedVaccineInfo.dateLabel } : null,
                  selectedHealthRecord.visitName ? { label: "Visit", value: selectedHealthRecord.visitName } : null,
                  selectedHealthRecord.doseNumber != null ? { label: "Dose", value: String(selectedHealthRecord.doseNumber) } : null,
                  selectedHealthRecord.isAutoGenerated ? { label: "Schedule", value: "EPI" } : null,
                  selectedHealthRecord.reactionSeverity ? { label: "Recorded reaction", value: selectedHealthRecord.reactionSeverity } : null,
                  selectedHealthRecord.reaction ? { label: "Reaction notes", value: selectedHealthRecord.reaction } : null,
              ].filter(Boolean)
            : selectedIsMedication
            ? [
                  selectedHealthRecord.resolved === true && selectedHealthRecord.resolvedDate
                      ? { label: "Finished", value: shortDate(selectedHealthRecord.resolvedDate) }
                      : null,
                  selectedHealthRecord.doseAmount
                      ? { label: "Dose", value: selectedHealthRecord.doseAmount }
                      : null,
                  selectedHealthRecord.frequencyPerDay
                      ? {
                            label: "Frequency",
                            value: `${selectedHealthRecord.frequencyPerDay} ${selectedHealthRecord.frequencyPerDay === 1 ? "time" : "times"} a day`,
                        }
                      : null,
                  selectedHealthRecord.courseDays
                      ? { label: "Course", value: `${selectedHealthRecord.courseDays} days` }
                      : null,
                  doseTimesOf(selectedHealthRecord).length
                      ? { label: "Scheduled times", value: doseTimesOf(selectedHealthRecord).map(shortTime).join(", ") }
                      : null,
                  selectedHealthRecord.prescribedBy
                      ? { label: "Prescribed by", value: selectedHealthRecord.prescribedBy }
                      : null,
                  conditionTitle(selectedHealthRecord.treatsId)
                      ? { label: "For", value: conditionTitle(selectedHealthRecord.treatsId) }
                      : null,
              ].filter(Boolean)
            : selectedIsHospitalization
            ? [
                  { label: "Duration", value: hospitalStayInfo(selectedHealthRecord, appointmentDay).durationLabel },
                  selectedHealthRecord.resolvedDate
                      ? { label: "Discharged", value: shortDate(selectedHealthRecord.resolvedDate) }
                      : null,
                  selectedHealthRecord.facility
                      ? { label: "Hospital", value: selectedHealthRecord.facility }
                      : null,
              ].filter(Boolean)
            : selectedIsCondition
            ? [
                  selectedHealthRecord.category === "Allergy"
                      ? { label: "Saved status", value: conditionStatus(selectedHealthRecord) }
                      : null,
                  selectedHealthRecord.category === "Allergy"
                      ? { label: "Allergy Type", value: selectedHealthRecord.allergyType === "food" ? "Food" : selectedHealthRecord.allergyType === "non_food" ? "Non-food" : "Not specified" }
                      : null,
                  selectedHealthRecord.resolvedDate
                      ? { label: "Ended", value: shortDate(selectedHealthRecord.resolvedDate) }
                      : null,
                  selectedHealthRecord.careLevel
                      ? { label: "Care", value: CARE_LABELS[selectedHealthRecord.careLevel] || selectedHealthRecord.careLevel }
                      : null,
              ].filter(Boolean)
            : [
                  selectedHealthRecord.provider ? { label: "Provider", value: selectedHealthRecord.provider } : null,
                  appointmentsReady ? { label: "Calendar plan", value: APPOINTMENT_STATUS_LABELS[selectedHealthRecord.calendarStatus || "other"] } : null,
              ].filter(Boolean),
        notes: selectedIsMedication
            ? selectedHealthRecord.instructions
            : selectedIsCondition || selectedIsHospitalization ? selectedHealthRecord.desc : selectedHealthRecord.notes,
        showDate: selectedIsVaccination ? false : undefined,
        showTime: selectedIsHospitalization || selectedIsVaccination ? false : undefined,
        showReminder: false,
        deleteLabel: selectedIsVaccination ? "Delete vaccination" : selectedIsMedication
            ? "Delete medicine"
            : selectedIsHospitalization
              ? "Delete hospital stay"
              : selectedIsCondition ? `Delete ${selectedConditionMeta.label.toLowerCase()} record` : "Delete appointment",
    } : null;

    // The PDF export used to live here. It moved to Share Records, where the
    // printout is generated from the SAME record selection as the QR code —
    // paper and screen now say the same thing. This screen is for browsing a
    // child's records; an export button above its tab bar belonged to neither
    // the tabs below it nor the care-team card above it.
    return (
        <PullToRefreshScrollView scope={profile.id} refreshing={listLoading} onRefresh={refreshHealth}
            scrollRef={healthScrollRef} onContentSizeChange={vaccineFocus.onContentSizeChange}
            error={refreshFailures.length ? "Some records could not be refreshed. Please retry." : ""}
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
        >
            <TipStrip tipKey="tip_health">
                Every vaccine in the DOH schedule is already here, dated from your child's birthday. Use Mark given to record an administered dose.
            </TipStrip>

            <NeumorphicTabs tabs={HEALTH_TABS} value={activeTab} onChange={setActiveTab}
                style={styles.tabContainer} />

            {/* TAB: VACCINES */}
            {activeTab === "immunizations" && (
                <ImmunizationRecordsCard key={`vaccinations-${profile.id}`} summary={vaccineSummary}
                    navigationFocus={vaccineFocus}
                    loading={!vaccinationCache.hasFetched && (vaxLoading || healthRefreshing)}
                    loadFailed={!vaccinationCache.hasFetched && !vaxLoading && !healthRefreshing}
                    onRetry={refreshHealth} onAdd={() => openVaccineEditor()}
                    onOpen={record => setDetailHealthRecord({ kind: "vaccination", record })}
                    onToggle={handleToggleVaccine} busyId={vaccineBusyId} completing={completingVaccine}
                    attachmentUrl={record => attachUrlFor("vaccination", record.id)}
                    onOpenAttachment={record => openViewer("vaccination", record.id)}
                    canGenerate={vaccinationCache.hasFetched && !hasEpiSchedule}
                    generating={generatingSchedule} onGenerate={handleGenerateSchedule} />
            )}

            {/* TAB: MEDICINES */}
            {activeTab === "medications" && <View>
                <SectionContainerCard title={t("healthMedicationReminders")} subtitle={t("healthMedicationRemindersSub")}
                    style={styles.medicineSection} headerStyle={styles.medicineHeader} titleStyle={styles.medicineHeading} subtitleStyle={styles.medicineSubtitle} background={<MedicineSurface />}
                    action={<GlassFab onPress={() => setMedicineForm({ record: null })}
                        style={{ width: MIN_TOUCH, height: MIN_TOUCH }} accessibilityLabel="Add a medicine" />}>
                    {histLoading && <AppointmentsSkeleton count={3} />}
                    {!histLoading && medications.length === 0 && <EmptyStateCard message="Nothing recorded yet." icon={<MedicationIcon size={36} />} />}
                    {!histLoading && activeMeds.length > 0 && !notificationsAvailable() && <MedicineReminderBanner />}
                    {!histLoading && activeMeds.map(med => <MedicineCourseCard key={med.id} med={med}
                        doses={dosesOn(doses, med.id, todayLocal())}
                        onOpen={() => setDetailHealthRecord({ kind: "medication", record: med })}
                        onGive={() => handleGiveDose(med)}
                        busyAction={recordOperations.some(op => op.child === String(profile.id) && op.resource === "medication-doses"
                            && op.entity === `med:${med.id}` && ["saving", "uncertain"].includes(op.status)) ? `give:${med.id}` : null} />)}
                </SectionContainerCard>
                {!histLoading && [{ title: "Finished", subtitle: "Medicines your child is no longer taking", rows: finishedMeds },
                    { title: "Other medicines", subtitle: "Courses not currently being taken", rows: otherMeds }].filter(group => group.rows.length).map(group =>
                    <SectionContainerCard key={group.title} title={group.title} subtitle={group.subtitle}
                        style={[styles.medicineSection, styles.medicineHistorySection]} headerStyle={[styles.medicineHeader, styles.medicineHistoryHeader]} titleStyle={styles.medicineHeading} subtitleStyle={styles.medicineSubtitle} background={<MedicineSurface />}>
                        <AnimatedReveal contentStyle={styles.medicineHistoryList}>
                            {group.rows.slice(0, medsVisible).map(med => <TouchableOpacity key={med.id} style={[styles.medicineItem, styles.finishedMedicine]}
                                onPress={() => setDetailHealthRecord({ kind: "medication", record: med })}
                                accessibilityRole="button" accessibilityLabel={"View " + med.title + " details, " + medicationLabel(med)}>
                                <MedicineSurface item radius={24} />
                                <MedicationIcon record={med} size={56} />
                                <Text style={[styles.courseTitle, { flex: 1, minWidth: 0 }]}>{med.title}</Text>
                                <View style={[styles.medicineBadge, med.resolved !== true && { backgroundColor: colors.surfaceAlt }]}>
                                    {med.resolved === true ? <Gradient pointerEvents="none" colors={colors.medicineSurface.badgeGradient} style={[StyleSheet.absoluteFillObject, { borderRadius: 999 }]} /> : null}
                                    <Text style={[styles.medicineBadgeText, med.resolved !== true && { color: colors.textSecondary }]}>{medicationLabel(med)}</Text>
                                </View>
                            </TouchableOpacity>)}
                            <ShowMore total={group.rows.length} visible={medsVisible} onPress={() => setMedsVisible(c => c + 10)} noun="medicines" />
                        </AnimatedReveal>
                    </SectionContainerCard>)}
            </View>}

            {/* TAB: ILLNESSES & ALLERGIES */}
            {activeTab === "illnesses" && (
                <IllnessesConditionsCard key={`conditions-${profile.id}`} summary={conditionSummary} today={appointmentDay}
                    loading={!medicalHistoryCache.hasFetched && (histLoading || healthRefreshing)}
                    loadFailed={!medicalHistoryCache.hasFetched && !histLoading && !healthRefreshing && refreshFailures.includes("medical-history")}
                    onRetry={refreshHealth} onAdd={() => setMedEvent({ kind: "illness", record: null })}
                    onOpen={record => setDetailHealthRecord({ kind: "illness", record })}
                    onEdit={record => setMedEvent({ kind: "illness", record })}
                    onDelete={record => setHealthDeleteCandidate({ kind: "illness", record })} />
            )}

            {/* TAB: CHECKUPS */}
            {activeTab === "appointments" && (
                <View>
                    <ConsultationsAppointmentsCard key={profile.id} summary={appointmentData}
                        loading={!appointmentsReady && (apptsLoading || healthRefreshing)} loadFailed={!appointmentsReady && !apptsLoading && !healthRefreshing}
                        onRetry={refreshHealth} onAdd={() => openAppointmentEditor()}
                        onOpen={appt => setDetailHealthRecord({ kind: "checkup", record: appt })}
                        attachmentUrl={appt => attachUrlFor("checkup", appt.id)}
                        onOpenAttachment={appt => openViewer("checkup", appt.id)} />

                    <HospitalStaysCard key={`hospital-${profile.id}`} summary={hospitalSummary}
                        loading={!medicalHistoryCache.hasFetched && (histLoading || healthRefreshing)}
                        loadFailed={!medicalHistoryCache.hasFetched && !histLoading && !healthRefreshing} onRetry={refreshHealth}
                        onAdd={() => setMedEvent({ kind: "hospitalization", record: null })}
                        onOpen={stay => setDetailHealthRecord({ kind: "hospitalization", record: stay })}
                        attachmentUrl={stay => attachUrlFor("hospitalization", stay.id)}
                        onOpenAttachment={stay => openViewer("hospitalization", stay.id)} />
                </View>
            )}

            <PlanDetail
                visible={!!detailHealthRecord}
                plan={healthDetailPlan}
                onClose={() => setDetailHealthRecord(null)}
                onViewAttachment={(selectedIsVaccination || selectedIsMedication || selectedIsCondition || selectedIsHospitalization) && selectedHealthRecord && !selectedHealthRecord.legacy
                    && attachUrlFor(selectedIsVaccination ? "vaccination" : selectedIsMedication ? "medication" : conditionAttachmentType(selectedHealthRecord.category), selectedHealthRecord.id)
                    ? () => {
                          const attachmentType = selectedIsVaccination ? "vaccination" : selectedIsMedication ? "medication" : conditionAttachmentType(selectedHealthRecord.category);
                          setDetailHealthRecord(null);
                          openViewer(attachmentType, selectedHealthRecord.id);
                      }
                    : undefined}
                onEdit={() => {
                    if (selectedIsVaccination) {
                        setDetailHealthRecord(null);
                        openVaccineEditor(selectedHealthRecord);
                    } else if (selectedIsMedication) {
                        setDetailHealthRecord(null);
                        setMedicineForm({ record: selectedHealthRecord });
                    } else if (selectedIsHospitalization) {
                        setDetailHealthRecord(null);
                        setMedEvent({ kind: "hospitalization", record: selectedHealthRecord });
                    } else if (selectedIsCondition) {
                        setDetailHealthRecord(null);
                        setMedEvent({ kind: "illness", record: selectedHealthRecord });
                    } else {
                        openAppointmentEditor(selectedHealthRecord);
                    }
                }}
                onDelete={() => setHealthDeleteCandidate(detailHealthRecord)}
                deleting={deletingHealthRecord}
                heroContent={selectedIsVaccination ? <VaccineIcon size={56} /> : selectedIsCondition ? <RecordIcon category={selectedHealthRecord.category} size={56} /> : selectedIsMedication ? <MedicationIcon record={selectedHealthRecord} size={56} /> : selectedIsHospitalization ? <HospitalStayIcon size={56} /> : undefined}
            >
                {selectedIsMedication && selectedHealthRecord ? <View style={{ gap: space.sm }}>
                    <Text style={styles.courseTitle}>Doses recorded today</Text>
                    {!dosesOn(doses, selectedHealthRecord.id, todayLocal()).length ? <Text style={styles.courseDetail}>No doses recorded today.</Text> : null}
                    {dosesOn(doses, selectedHealthRecord.id, todayLocal()).map(dose => {
                        const locked = recordOperations.some(op => op.child === String(profile.id) && op.resource === "medication-doses"
                            && op.entity === `med:${selectedHealthRecord.id}` && ["saving", "uncertain"].includes(op.status));
                        return <View key={dose.id} style={styles.recordedDose}>
                            <Text style={styles.courseDetail}>{shortTime(dose.time)}</Text>
                            <TouchableOpacity onPress={() => handleUndoDose(dose)} disabled={locked} style={styles.doseUndo}
                                accessibilityRole="button" accessibilityLabel={"Undo dose recorded at " + shortTime(dose.time)}
                                accessibilityState={{ disabled: locked, busy: locked }}>
                                <Text style={{ ...type.label, color: colors.primaryDark }}>Undo</Text>
                            </TouchableOpacity>
                        </View>;
                    })}
                </View> : null}
            </PlanDetail>

            <DeleteConfirmation visible={!!healthDeleteCandidate} title={healthDeleteCandidate?.kind === "vaccination" ? "Delete vaccination?" : healthDeleteCandidate?.kind === "medication" ? "Delete medicine?" : healthDeleteCandidate?.kind === "hospitalization" ? "Delete hospital stay?" : healthDeleteCandidate?.kind === "illness" ? `Delete ${healthDeleteCandidate.record.category === "Hereditary Condition" ? "hereditary condition" : String(healthDeleteCandidate.record.category || "illness").toLowerCase()} record?` : "Delete appointment?"}
 message={healthDeleteCandidate ? `Delete "${healthDeleteCandidate.record.vaccineName || healthDeleteCandidate.record.title}"? This cannot be undone.` : ""} busy={deletingHealthRecord}
 onCancel={() => setHealthDeleteCandidate(null)} onConfirm={() => deleteHealthRecord()} />

            {/* One form for illnesses and hospital stays — same record type,
                same bugs, so one implementation keeps them fixed together. */}
            <MedicalEventModal
                visible={!!medEvent}
                kind={medEvent ? medEvent.kind : "illness"}
                profile={profile}
                record={medEvent ? medEvent.record : null}
                previous={conditions.filter((record) => record.category === "Illness")}
                onClose={() => setMedEvent(null)}
                onSaved={handleMedEventSaved}
                onDelete={(record) => deleteHealthRecord({ kind: "illness", record })}
            />

            <MedicineModal
                visible={!!medicineForm}
                profile={profile}
                record={medicineForm ? medicineForm.record : null}
                previousNames={previousMedNames}
                conditions={linkableConditions}
                onClose={() => setMedicineForm(null)}
                onSaved={handleMedicineSaved}
                onDelete={(record) => deleteHealthRecord({ kind: "medication", record })}
            />

            {/* Add Vaccine Modal */}
            <RecordFormSheet visible={showVaxModal} title={editingVaccine ? "Edit Vaccination" : "Add Vaccination"}
                onClose={() => { setShowVaxModal(false); resetVaxForm(); }} onSubmit={handleAddVaccine} busy={addingVaccine}
                cancelLabel={t("cancel")} submitLabel={t("save")}
                record={editingVaccine} onDelete={editingVaccine ? () => deleteHealthRecord({ kind: "vaccination", record: editingVaccine }) : undefined} deleteTitle={"Delete vaccination?"} deleteMessage={`Delete "${editingVaccine?.vaccineName || ""}"? This cannot be undone.`}>
                <RecordFormGroup>

                        {/* Picked from the DOH list, not typed. A blank box
                            asking a parent to name a vaccine is close to
                            unanswerable — and the app already holds the
                            canonical list the due dates come from. */}
                        <FieldShell label="Vaccine" focused={vaxPickerOpen}>
                        <TouchableOpacity
                            ref={vaxPickerRef}
                            style={styles.pickerTrigger}
                            onPress={() => vaxPickerRef.current?.measureInWindow((x, y, width, height) => {
                                setVaxPickerAnchor({ x, y, width, height });
                                setVaxPickerOpen(true);
                            })}
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
                        </FieldShell>

                        {/* Revealed only when the parent picks "Something else",
                            so the free-text path still exists for a vaccine the
                            DOH list does not carry (a private-sector one, or a
                            dose given abroad) without being the default. */}
                        {vaxIsOther && (
                            <Field
                                label="Vaccine name"
                                placeholder="Vaccine name"
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

                        <DateField label="Due Date" value={vaxDue} required={!editingVaccine?.isCompleted} error={vaxDueError}
                            onChange={value => { setVaxDue(value); setVaxDueError(""); }} />

                        <PhotoAttach
                            required={false}
                            label="Supporting Photo (optional)"
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                </RecordFormGroup>
            </RecordFormSheet>

            {/* New Appointment Modal */}
            <RecordFormSheet visible={showApptModal} title={editingAppointment ? "Edit Appointment" : "New Appointment"}
                onClose={() => { setShowApptModal(false); setEditingAppointment(null); }} onSubmit={handleAddAppointment} busy={addingAppointment}
                cancelLabel={t("cancel")} submitLabel={editingAppointment ? "Save" : "Schedule"}
                record={editingAppointment} onDelete={editingAppointment ? () => deleteHealthRecord({ kind: "checkup", record: editingAppointment }) : undefined} deleteTitle={"Delete appointment?"} deleteMessage={`Delete "${editingAppointment?.title || ""}"? This cannot be undone.`}>
                <RecordFormGroup>

                        <RecordFormRow label={<Text style={styles.modalLabel}>Appointment Title</Text>}>

                        <TextInput
                            style={styles.modalInput}
                            value={apptTitle}
                            onChangeText={setApptTitle}
                        />
                        </RecordFormRow>

                        <RecordFormRow label={<Text style={styles.modalLabel}>
                            Pediatrician / Provider
                        </Text>}>

                        <TextInput
                            style={styles.modalInput}
                            value={apptDoctor}
                            onChangeText={setApptDoctor}
                        />
                        </RecordFormRow>

                        <View style={modalTwoCol ? styles.formRow : styles.formStack}>
                            <View style={modalTwoCol ? styles.formCell : styles.formCellFull}>
                                <RecordFormRow label={<Text style={styles.modalLabel}>Date</Text>}>

                                <DateField value={apptDate} onChange={setApptDate} />
                                </RecordFormRow>
                            </View>
                            <View style={modalTwoCol ? styles.formCell : styles.formCellFull}>
                                <RecordFormRow label={<Text style={styles.modalLabel}>Time</Text>}>

                                <TimeField value={apptTime} onChange={setApptTime} />
                                </RecordFormRow>
                            </View>
                        </View>

                        <RecordFormRow label={<Text style={styles.modalLabel}>
                            Clinic Guidelines / Notes
                        </Text>}>

                        <TextInput
                            style={styles.modalInput}
                            value={apptNotes}
                            onChangeText={setApptNotes}
                        />
                        </RecordFormRow>

                        <PhotoAttach
                            required={!editingAppointment}
                            label={editingAppointment ? "Replace Supporting Photo (optional)" : undefined}
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                </RecordFormGroup>
            </RecordFormSheet>

            <RecordFormSheet visible={!!completeVaxTarget} title={"Mark Dose Given"}
                onClose={() => setCompleteVaxTarget(null)} onSubmit={handleConfirmCompleteWithPhoto} busy={completingVaccine}
                cancelLabel={t("cancel")} submitLabel={"Confirm"}>
                <RecordFormGroup>

                        <RecordFormRow label={<Text style={styles.modalLabel}>
                            {completeVaxTarget ? completeVaxTarget.vaccineName : ""}
                        </Text>}>

                            {/* Editable, not assumed. A parent recording a dose
                                a week after the clinic visit was previously
                                forced to file it as today's. */}
                            <DateField
                                label="Date given"
                                value={completeDate}
                                onChange={setCompleteDate}
                                maximumDate={todayLocal()}
                            />
                        </RecordFormRow>

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
                                    <Field
                                        label="What happened?"
                                        placeholder="What happened?"
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

                </RecordFormGroup>
            </RecordFormSheet>

            {/* The DOH vaccine list. "Something else" sits first so a
                private-sector or overseas dose — the one case the list cannot
                cover — is the first thing a parent sees rather than something
                they scroll seventeen doses to find. */}
            <OptionSheet
                visible={vaxPickerOpen}
                anchor={vaxPickerAnchor}
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
                busyAction={attachmentAction}
            />
        </PullToRefreshScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "transparent", // lets App.js's page gradient show through
    },
    // Padding belongs on the CONTENT, not the ScrollView itself: padding on
    // the scroll view's own box does not scroll with the content, so the
    // bottom clearance that keeps the last card above the tab bar and the
    // floating button has to live here.
    content: {
        padding: space.lg,
    },
    tabContainer: { marginBottom: space.lg },
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


    // ---- A running medicine course ----
    medicineHeader: { marginBottom: 20 },
    medicineHeading: { ...type.title, fontSize: 20, lineHeight: 28, color: colors.text },
    medicineSubtitle: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 4 },
    medicineSection: { padding: 20, borderWidth: 0, borderRadius: 28, backgroundColor: colors.medicineSurface.section[0], boxShadow: colors.medicineSurface.shadow },
    medicineItem: { padding: space.lg, marginBottom: space.sm, borderRadius: 24, backgroundColor: colors.medicineSurface.item[0], boxShadow: colors.medicineSurface.itemShadow },
    medicineHistorySection: { padding: 0 },
    medicineHistoryHeader: { paddingHorizontal: 20, paddingTop: 20, marginBottom: 8 },
    // Include shadow clearance in the reveal measurement, not outside its clip.
    medicineHistoryList: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
    finishedMedicine: { marginBottom: 12, overflow: "visible", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.lg },
    medicineBadge: { borderRadius: 999, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.medicineSurface.badge, boxShadow: "inset 0 1px 2px " + colors.medicineSurface.highlight, maxWidth: "100%" },
    medicineBadgeText: { ...type.caption, fontWeight: "600", color: colors.medicineSurface.badgeText },
    recordedDose: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
    doseUndo: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: "center", alignItems: "center", paddingHorizontal: space.md },
    courseHead: { flexDirection: "row", alignItems: "center", gap: space.lg },
    listIconTile: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    courseTitle: { ...type.bodyStrong, fontSize: 18, lineHeight: 26, color: colors.text },
    courseDetail: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },


    courseFoot: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.lg,
        marginTop: 20,
    },
    courseFootStacked: { flexDirection: "column", alignItems: "stretch" },
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
        // Zero horizontal padding keeps all four filter labels readable: four
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
    // 13px keeps four filter labels readable. Both states are the same
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

    // The scroller that lets a tall sheet reach its own Save button.

    // Paired form fields; `formStack` is the same fields one per line.
    formRow: { flexDirection: "row", gap: space.sm },
    formStack: { flexDirection: "column" },
    formCell: { flex: 1, minWidth: 0 },
    formCellFull: { width: "100%" },

    modalLabel: {
        ...type.subheading,
        color: colors.textMuted,
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: "transparent",
        borderWidth: 0,
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        minHeight: 52,
        paddingVertical: space.sm,
        fontSize: type.body.fontSize,
        fontFamily: type.body.fontFamily,
        color: colors.text,
        marginBottom: 16,
    },

    // The Mark Dose Given step now carries a date, a reaction and a photo, so
    // it scrolls rather than growing past the screen on a small phone.
    // maxHeight is applied inline as a fraction of the window — a hardcoded
    // 380 was taller than the usable area on a short phone and did not move
    // when the OS font scale grew the fields inside it.

    // Opens the vaccine picker. Reads like an input so it is obviously a field,
    // not a button that navigates away.
    pickerTrigger: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 0,
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        minHeight: 50,
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

});
