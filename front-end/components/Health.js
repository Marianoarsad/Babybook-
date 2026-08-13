import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Image,
} from "react-native";
import { api } from "../utils/api";
import {
    vaccinationToApp,
    medHistoryToIllness,
    medHistoryToMed,
    checkupToApp,
} from "../utils/adapters";
import { scheduleReminder, morningOf } from "../utils/notifications";
import { exportChildRecordsPdf, pdfExportAvailable } from "../utils/exportPdf";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { radius, space, type, shadow } from "../theme";
import {
    SectionContainerCard,
    ListEntryCard,
    EmptyStateCard,
} from "./common/Cards";
import PhotoAttach from "./ui/PhotoAttach";
import ShowMore from "./ui/ShowMore";
import { ImmunizationsSkeleton, AppointmentsSkeleton } from "./ui/Skeleton";
import { DateField, TimeField } from "./ui/DateField";
import ImageViewer from "./ui/ImageViewer";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

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
    const Alert = {
        alert: (title, message) => {
            const m = message || title || "";
            if (title === "Error" || /invalid|fail|denied|unable/i.test(String(title))) toast.error(m);
            else toast.success(m);
        },
    };
    const [activeTab, setActiveTab] = useState("immunizations");
    // Apply a deep-link tab request from the floating log button, and — for
    // "Add Medication" — open the Add Rx form directly instead of just
    // switching tabs, matching the pattern used for Growth's own shortcuts.
    // "vaccine"/"illness"/"hospitalization" are distinct from the plain tab
    // names ("immunizations"/"illnesses") on purpose: the Dashboard's Needs
    // Attention card already deep-links here with the plain tab names just to
    // switch tabs (e.g. tapping an overdue vaccine), so those two must keep
    // meaning "switch tabs only" — the new FAB shortcuts need their own keys
    // to additionally pop open an add-record form.
    useEffect(() => {
        const tabFor = {
            immunizations: "immunizations",
            medications: "medications",
            illnesses: "illnesses",
            appointments: "appointments",
            vaccine: "immunizations",
            illness: "illnesses",
            hospitalization: "appointments",
        };
        if (initialTab && tabFor[initialTab]) {
            setActiveTab(tabFor[initialTab]);
            if (initialTab === "medications") {
                resetAttach();
                setShowMedModal(true);
            }
            if (initialTab === "appointments") {
                resetAttach();
                setShowApptModal(true);
            }
            if (initialTab === "vaccine") {
                resetAttach();
                setShowVaxModal(true);
            }
            if (initialTab === "illness") {
                resetAttach();
                setShowIllnessModal(true);
            }
            if (initialTab === "hospitalization") {
                resetAttach();
                setShowHospModal(true);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    // Vaccinations now load from and persist to the backend.
    const [vaccines, setVaccines] = useState([]);
    const [vaxLoading, setVaxLoading] = useState(true);
    useEffect(() => {
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

    // Checkups now load from and persist to the backend.
    const [appts, setAppts] = useState([]);
    const [apptsLoading, setApptsLoading] = useState(true);
    const [apptsVisible, setApptsVisible] = useState(10);
    useEffect(() => {
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
        const today = new Date().toISOString().split("T")[0];
        if (v.dueDate && v.dueDate < today) return "overdue";
        return "due";
    };

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

    // Care Team state
    const [pediatrician, setPediatrician] = useState(
        profile.pediatricianName || "Dr. Sarah Chen",
    );
    const [hospital, setHospital] = useState(
        profile.hospital || "St. Jude Medical Center",
    );

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
    const [showIllnessModal, setShowIllnessModal] = useState(false);
    const [illnessTitle, setIllnessTitle] = useState("");
    const [illnessDesc, setIllnessDesc] = useState("");
    const [illnessVisible, setIllnessVisible] = useState(10);

    const [medications, setMedications] = useState([]);
    const [showMedModal, setShowMedModal] = useState(false);
    const [medTitle, setMedTitle] = useState("");
    const [medDosage, setMedDosage] = useState("");
    const [medsVisible, setMedsVisible] = useState(10);

    const [hospitalizations, setHospitalizations] = useState([]);
    const [showHospModal, setShowHospModal] = useState(false);
    const [hospTitle, setHospTitle] = useState("");
    const [hospDesc, setHospDesc] = useState("");
    const [hospVisible, setHospVisible] = useState(10);

    // Appointment (checkup) adding state
    const [showApptModal, setShowApptModal] = useState(false);
    const [apptTitle, setApptTitle] = useState("Developmental Assessment");
    const [apptDoctor, setApptDoctor] = useState("Dr. Sarah Chen");
    const [apptDate, setApptDate] = useState("2026-06-30");
    const [apptTime, setApptTime] = useState("10:00");
    const [apptNotes, setApptNotes] = useState("");

    // Medical history (illnesses + medications) loads from the backend.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "medical-history");
                if (!active) return;
                setIllnesses(rows.filter((r) => r.category === "Illness").map(medHistoryToIllness));
                setMedications(rows.filter((r) => r.category === "Medication").map(medHistoryToMed));
                setHospitalizations(rows.filter((r) => r.category === "Hospitalization").map(medHistoryToIllness));
            } catch (e) {
                console.log("load medical history:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    // ===== Mandatory supporting-photo attachments =====
    const [attachUri, setAttachUri] = useState("");
    const [attachMap, setAttachMap] = useState({}); // `${type}:${id}` -> attachment row
    const [viewer, setViewer] = useState(null); // { uri, type, recordId, attachId }

    const loadAttachments = async () => {
        try {
            const rows = await api.listAttachments(profile.id);
            const map = {};
            for (const a of rows) map[`${a.record_type}:${a.record_id}`] = a;
            setAttachMap(map);
        } catch (e) {
            console.log("load attachments:", e.message);
        }
    };
    useEffect(() => {
        loadAttachments();
    }, [profile.id]);

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
    const [showVaxModal, setShowVaxModal] = useState(false);
    const [vaxName, setVaxName] = useState("");
    const [vaxVisit, setVaxVisit] = useState("");
    const [vaxDue, setVaxDue] = useState("");

    const handleAddVaccine = async () => {
        if (!vaxName) {
            Alert.alert("Error", "Please enter a vaccine name");
            return;
        }
        if (!requireAttach()) return;
        const name = vaxName;
        const visit = vaxVisit;
        const due = vaxDue;
        setShowVaxModal(false);
        setVaxName("");
        setVaxVisit("");
        setVaxDue("");
        try {
            const saved = await api.createRecord(profile.id, "vaccinations", {
                vaccine_name: name,
                visit_name: visit || null,
                due_date: due || null,
                status: "scheduled",
            });
            setVaccines((prev) => [...prev, vaccinationToApp(saved)]);
            await uploadAttachFor("vaccination", saved.id);
            // Set a reminder for the due date: notification + backend record.
            const when = morningOf(due);
            if (when) {
                scheduleReminder("Vaccination reminder", `${name} — ${visit || "vaccination"} due`, when);
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
            Alert.alert("Error", e.message || "Could not add vaccine");
        }
    };

    const applyVaccineToggle = async (vax, nowCompleted) => {
        const today = new Date().toISOString().split("T")[0];
        // optimistic update
        setVaccines((prev) =>
            prev.map((v) =>
                v.id === vax.id
                    ? { ...v, isCompleted: nowCompleted, completedDate: nowCompleted ? today : undefined }
                    : v,
            ),
        );
        try {
            await api.updateRecord(profile.id, "vaccinations", vax.id, {
                status: nowCompleted ? "completed" : "scheduled",
                date_given: nowCompleted ? today : null,
            });
        } catch (e) {
            // revert on failure
            setVaccines((prev) => prev.map((v) => (v.id === vax.id ? vax : v)));
            Alert.alert("Error", e.message || "Could not update vaccine");
        }
    };

    // Marking a dose "given" requires a supporting photo (vaccination card),
    // same as any other record with a mandatory attachment — but this one
    // is required only at completion time, not while the dose is scheduled.
    const [completeVaxTarget, setCompleteVaxTarget] = useState(null);
    const [completeAttachUri, setCompleteAttachUri] = useState("");

    const handleToggleVaccine = async (id) => {
        const vax = vaccines.find((v) => v.id === id);
        if (!vax) return;
        const nowCompleted = !vax.isCompleted;
        if (nowCompleted && !attachUrlFor("vaccination", id)) {
            setCompleteAttachUri("");
            setCompleteVaxTarget(vax);
            return;
        }
        await applyVaccineToggle(vax, nowCompleted);
    };

    const handleConfirmCompleteWithPhoto = async () => {
        if (!completeAttachUri) {
            toast.error("A supporting photo is required to mark this dose given.");
            return;
        }
        const vax = completeVaxTarget;
        setCompleteVaxTarget(null);
        await applyVaccineToggle(vax, true);
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

    const handleAddIllness = async () => {
        if (!illnessTitle) {
            Alert.alert("Error", "Please enter illness name");
            return;
        }
        if (!requireAttach()) return;
        const title = illnessTitle;
        const desc = illnessDesc;
        setShowIllnessModal(false);
        setIllnessTitle("");
        setIllnessDesc("");
        try {
            const saved = await api.createRecord(profile.id, "medical-history", {
                category: "Illness",
                title,
                description: desc || null,
                date_recorded: new Date().toISOString().split("T")[0],
                resolved: false,
            });
            setIllnesses((prev) => [medHistoryToIllness(saved), ...prev]);
            await uploadAttachFor("illness", saved.id);
            Alert.alert("Success", "Medical condition recorded successfully.");
        } catch (e) {
            Alert.alert("Error", e.message || "Could not save condition");
        }
    };

    const handleAddMedication = async () => {
        if (!medTitle) {
            Alert.alert("Error", "Please enter medication name");
            return;
        }
        if (!requireAttach()) return;
        const title = medTitle;
        const dosage = medDosage;
        setShowMedModal(false);
        setMedTitle("");
        setMedDosage("");
        try {
            const saved = await api.createRecord(profile.id, "medical-history", {
                category: "Medication",
                title,
                description: dosage || null,
                date_recorded: new Date().toISOString().split("T")[0],
            });
            setMedications((prev) => [medHistoryToMed(saved), ...prev]);
            await uploadAttachFor("medication", saved.id);
            Alert.alert("Success", "Prescribed medication logged successfully.");
        } catch (e) {
            Alert.alert("Error", e.message || "Could not save medication");
        }
    };

    const handleAddHospitalization = async () => {
        if (!hospTitle) {
            Alert.alert("Error", "Please enter a reason for hospitalization");
            return;
        }
        if (!requireAttach()) return;
        const title = hospTitle;
        const desc = hospDesc;
        setShowHospModal(false);
        setHospTitle("");
        setHospDesc("");
        try {
            const saved = await api.createRecord(profile.id, "medical-history", {
                category: "Hospitalization",
                title,
                description: desc || null,
                date_recorded: new Date().toISOString().split("T")[0],
                resolved: false,
            });
            setHospitalizations((prev) => [medHistoryToIllness(saved), ...prev]);
            await uploadAttachFor("hospitalization", saved.id);
            Alert.alert("Success", "Hospitalization recorded.");
        } catch (e) {
            Alert.alert("Error", e.message || "Could not save hospitalization");
        }
    };

    const handleAddAppointment = async () => {
        if (!apptTitle || !apptDoctor || !apptDate) {
            Alert.alert("Error", "Please fill out required fields");
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
            Alert.alert(
                "Appointment Slotted",
                `Pediatric session scheduled successfully.`,
            );
        } catch (e) {
            Alert.alert("Error", e.message || "Could not save appointment");
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
        <ScrollView style={styles.container}>
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
                    Pediatrician: {pediatrician}
                </Text>
                <Text style={styles.careTeamText}>Hospital: {hospital}</Text>
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
                                            <Text style={[styles.filterChipText, vaxStatusFilter === f.key && styles.filterChipTextActive]}>
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
                                            <Text style={styles.vaxSub}>
                                                {vax.visitName} | Due: {vax.dueDate}
                                            </Text>
                                            {vax.notes && (
                                                <Text style={styles.vaxNotes}>
                                                    "{vax.notes}"
                                                </Text>
                                            )}
                                        </View>
                                        {attachUrlFor("vaccination", vax.id) ? (
                                            <TouchableOpacity
                                                onPress={() => openViewer("vaccination", vax.id)}
                                                style={styles.vaxThumbWrap}
                                            >
                                                <Image
                                                    source={{ uri: attachUrlFor("vaccination", vax.id) }}
                                                    style={styles.vaxThumb}
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

                    {/* Barangay / NCR vaccine stock alert */}
                    <SectionContainerCard
                        title={t("healthVaccineNCRStock")}
                        subtitle={t("healthVaccineNCRStockSub")}
                    >
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
                                    Local municipal clinics reporting
                                    replenishment by July 5th.
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
                                    Barangay centers hosting mass immunization
                                    weekend.
                                </Text>
                            </View>
                        </View>
                    </SectionContainerCard>
                </View>
            )}

            {/* TAB: MEDICATIONS */}
            {activeTab === "medications" && (
                <View>
                    <SectionContainerCard
                        title={t("healthMedicationReminders")}
                        subtitle={t("healthMedicationRemindersSub")}
                        action={
                            <TouchableOpacity
                                onPress={() => { resetAttach(); setShowMedModal(true); }}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add medication"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {medications.length === 0 && (
                            <EmptyStateCard message="No medications logged yet." icon="flask-outline" />
                        )}
                        {medications.slice(0, medsVisible).map((med, idx) => (
                            <ListEntryCard
                                key={med.id || idx}
                                thumbnailUrl={attachUrlFor("medication", med.id)}
                                onThumbnailPress={() => openViewer("medication", med.id)}
                                title={med.title}
                                subtitle={`Dosage: ${med.dosage}`}
                                label={
                                    <Text
                                        style={{
                                            ...type.caption,
                                            color: colors.textMuted,
                                        }}
                                    >
                                        Duration: {med.duration}
                                    </Text>
                                }
                                icon={
                                    <Ionicons
                                        name="flask-outline"
                                        size={18}
                                        color={colors.recMedication.on}
                                    />
                                }
                                iconBg={colors.recMedication.bg}
                            />
                        ))}
                        <ShowMore
                            total={medications.length}
                            visible={medsVisible}
                            onPress={() => setMedsVisible((c) => c + 10)}
                            noun="medications"
                        />
                    </SectionContainerCard>
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
                                    <Text style={styles.chipText}>{all}</Text>
                                    <TouchableOpacity
                                        onPress={() =>
                                            persistAllergies(
                                                allergies.filter((_, i) => i !== index),
                                            )
                                        }
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
                        title="Pediatric Conditions & Illnesses"
                        subtitle="Triage check-up log records"
                        action={
                            <TouchableOpacity
                                onPress={() => { resetAttach(); setShowIllnessModal(true); }}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add condition"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {illnesses.slice(0, illnessVisible).map((ill, idx) => (
                            <ListEntryCard
                                key={ill.id || idx}
                                thumbnailUrl={attachUrlFor("illness", ill.id)}
                                onThumbnailPress={() => openViewer("illness", ill.id)}
                                title={ill.title}
                                subtitle={`${ill.date}  |  ${ill.resolved ? "Resolved" : "Active"}`}
                                notes={ill.desc}
                                icon={
                                    <Ionicons
                                        name="pulse-outline"
                                        size={18}
                                        color={colors.recIllness.on}
                                    />
                                }
                                iconBg={colors.recIllness.bg}
                            />
                        ))}
                        <ShowMore
                            total={illnesses.length}
                            visible={illnessVisible}
                            onPress={() => setIllnessVisible((c) => c + 10)}
                            noun="conditions"
                        />
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
                                subtitle={`${appt.date} @ ${appt.time}`}
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
                        title="Hospitalizations"
                        subtitle="Hospital stays and admissions"
                        action={
                            <TouchableOpacity
                                onPress={() => { resetAttach(); setShowHospModal(true); }}
                                style={styles.actionBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add hospitalization"
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        }
                    >
                        {hospitalizations.length === 0 && (
                            <EmptyStateCard message="No hospitalizations recorded." icon="bandage-outline" />
                        )}
                        {hospitalizations.slice(0, hospVisible).map((h, idx) => (
                            <ListEntryCard
                                key={h.id || idx}
                                thumbnailUrl={attachUrlFor("hospitalization", h.id)}
                                onThumbnailPress={() => openViewer("hospitalization", h.id)}
                                title={h.title}
                                subtitle={h.date}
                                notes={h.desc}
                                icon={
                                    <Ionicons name="bandage-outline" size={18} color={colors.recHospitalization.on} />
                                }
                                iconBg={colors.recHospitalization.bg}
                            />
                        ))}
                        <ShowMore
                            total={hospitalizations.length}
                            visible={hospVisible}
                            onPress={() => setHospVisible((c) => c + 10)}
                            noun="hospitalizations"
                        />
                    </SectionContainerCard>
                </View>
            )}

            {/* Hospitalization Modal */}
            <Modal visible={showHospModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Hospitalization</Text>

                        <Text style={styles.modalLabel}>Reason / Title</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Dengue admission"
                            placeholderTextColor={colors.placeholder}
                            value={hospTitle}
                            onChangeText={setHospTitle}
                        />

                        <Text style={styles.modalLabel}>Details (optional)</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={hospDesc}
                            onChangeText={setHospDesc}
                        />

                        <PhotoAttach
                            required
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowHospModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddHospitalization}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>{t("save")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Illness Modal */}
            <Modal visible={showIllnessModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            Add Clinical Record
                        </Text>

                        <Text style={styles.modalLabel}>
                            Condition / Illness Title
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={illnessTitle}
                            onChangeText={setIllnessTitle}
                        />

                        <Text style={styles.modalLabel}>
                            Doctor Remarks & Advice
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={illnessDesc}
                            onChangeText={setIllnessDesc}
                        />

                        <PhotoAttach
                            required
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowIllnessModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddIllness}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("save")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Medication Modal */}
            <Modal visible={showMedModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            Add Prescribed Medication
                        </Text>

                        <Text style={styles.modalLabel}>Medication Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={medTitle}
                            onChangeText={setMedTitle}
                        />

                        <Text style={styles.modalLabel}>
                            Dosage guidelines (e.g. 5ml daily)
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={medDosage}
                            onChangeText={setMedDosage}
                        />

                        <PhotoAttach
                            required
                            uri={attachUri}
                            onChangeUri={setAttachUri}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowMedModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddMedication}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("save")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Vaccine Modal */}
            <Modal visible={showVaxModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Vaccination</Text>

                        <Text style={styles.modalLabel}>Vaccine Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. MMR"
                            placeholderTextColor={colors.placeholder}
                            value={vaxName}
                            onChangeText={setVaxName}
                        />

                        <Text style={styles.modalLabel}>
                            Visit (e.g. 12 Month Wellness)
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={vaxVisit}
                            onChangeText={setVaxVisit}
                        />

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
                </View>
            </Modal>

            {/* New Appointment Modal */}
            <Modal visible={showApptModal} transparent animationType="slide">
                <View style={styles.modalBg}>
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

                        <View style={{ flexDirection: "row", gap: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalLabel}>Date</Text>
                                <DateField value={apptDate} onChange={setApptDate} />
                            </View>
                            <View style={{ flex: 1 }}>
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
                </View>
            </Modal>

            <Modal visible={!!completeVaxTarget} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Mark Dose Given</Text>
                        <Text style={styles.modalLabel}>
                            {completeVaxTarget ? completeVaxTarget.vaccineName : ""}
                        </Text>
                        <PhotoAttach
                            required
                            uri={completeAttachUri}
                            onChangeUri={setCompleteAttachUri}
                            label="Vaccination Card Photo"
                            helper="Required to confirm this dose was given"
                        />
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
            </Modal>

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
        padding: 16,
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
    careTeamText: {
        ...type.caption,
        color: colors.textSecondary,
        marginTop: 2,
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
        paddingVertical: space.sm + 2,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
    },
    tabButtonActive: {
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    tabButtonText: {
        ...type.caption,
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primaryDark,
        ...type.label,
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
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
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
    filterRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 10,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
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
    filterChipText: {
        ...type.label,
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
        paddingVertical: 1,
    },
    // No type-scale role fits a badge this small — type.subheading (14px)
    // overflows the chip's 1px vertical padding. Deliberate literal exception.
    epiChipText: {
        fontFamily: "PublicSans_700Bold",
        fontSize: 9,
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
    modalCard: {
        backgroundColor: colors.background,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.border,
    },
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
