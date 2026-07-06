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
} from "../utils/adapters";
import { scheduleReminder, morningOf } from "../utils/notifications";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import {
    SectionContainerCard,
    ListEntryCard,
    EmptyStateCard,
} from "./common/Cards";
import PhotoAttach from "./ui/PhotoAttach";
import ImageViewer from "./ui/ImageViewer";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function Health({
    profile,
    onUpdateProfile,
    immunizations,
    setImmunizations,
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

    // Vaccinations now load from and persist to the backend.
    const [vaccines, setVaccines] = useState([]);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "vaccinations");
                if (active) setVaccines(rows.map(vaccinationToApp));
            } catch (e) {
                console.log("load vaccines:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

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

    const [medications, setMedications] = useState([]);
    const [showMedModal, setShowMedModal] = useState(false);
    const [medTitle, setMedTitle] = useState("");
    const [medDosage, setMedDosage] = useState("");

    const [hospitalizations, setHospitalizations] = useState([]);
    const [showHospModal, setShowHospModal] = useState(false);
    const [hospTitle, setHospTitle] = useState("");
    const [hospDesc, setHospDesc] = useState("");

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
    const [attachUrl, setAttachUrl] = useState("");
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
        setAttachUrl("");
    };
    const hasAttach = () => !!(attachUri || attachUrl);
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
                fileUrl: attachUrl,
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

    const handleToggleVaccine = async (id) => {
        const vax = vaccines.find((v) => v.id === id);
        if (!vax) return;
        const nowCompleted = !vax.isCompleted;
        const today = new Date().toISOString().split("T")[0];
        // optimistic update
        setVaccines((prev) =>
            prev.map((v) =>
                v.id === id
                    ? { ...v, isCompleted: nowCompleted, completedDate: nowCompleted ? today : undefined }
                    : v,
            ),
        );
        try {
            await api.updateRecord(profile.id, "vaccinations", id, {
                status: nowCompleted ? "completed" : "scheduled",
                date_given: nowCompleted ? today : null,
            });
        } catch (e) {
            // revert on failure
            setVaccines((prev) => prev.map((v) => (v.id === id ? vax : v)));
            Alert.alert("Error", e.message || "Could not update vaccine");
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
                        style={[
                            styles.tabButtonText,
                            activeTab === "medications" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Rx Meds
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
                        style={[
                            styles.tabButtonText,
                            activeTab === "illnesses" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Conditions
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
                            <TouchableOpacity
                                onPress={() => { resetAttach(); setShowVaxModal(true); }}
                                style={styles.actionBtn}
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                                <Text style={styles.actionBtnText}>Add</Text>
                            </TouchableOpacity>
                        }
                    >
                        {vaccines.length === 0 && (
                            <EmptyStateCard message="No vaccination records yet." />
                        )}
                        {vaccines.map((vax, idx) => (
                            <TouchableOpacity
                                key={vax.id || idx}
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
                                    <Text
                                        style={[
                                            styles.vaxTitle,
                                            vax.isCompleted &&
                                                styles.vaxTitleCompleted,
                                        ]}
                                    >
                                        {vax.vaccineName}
                                    </Text>
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
                            >
                                <Ionicons
                                    name="add"
                                    size={14}
                                    color="#FFFFFF"
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={styles.actionBtnText}>Add Rx</Text>
                            </TouchableOpacity>
                        }
                    >
                        {medications.map((med, idx) => (
                            <ListEntryCard
                                key={med.id || idx}
                                thumbnailUrl={attachUrlFor("medication", med.id)}
                                onThumbnailPress={() => openViewer("medication", med.id)}
                                title={med.title}
                                subtitle={`Dosage: ${med.dosage}`}
                                label={
                                    <Text
                                        style={{
                                            fontSize: 11,
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
                                        color={colors.primary}
                                    />
                                }
                                iconBg={colors.tintGreen}
                            />
                        ))}
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
                                <Text style={{ fontSize: 12, color: colors.textMuted }}>
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
                            >
                                <Ionicons
                                    name="add"
                                    size={14}
                                    color="#FFFFFF"
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={styles.actionBtnText}>
                                    Add Log
                                </Text>
                            </TouchableOpacity>
                        }
                    >
                        {illnesses.map((ill, idx) => (
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
                                        color={colors.primary}
                                    />
                                }
                                iconBg={colors.tintGreen}
                            />
                        ))}
                    </SectionContainerCard>

                    <SectionContainerCard
                        title="Hospitalizations"
                        subtitle="Hospital stays and admissions"
                        action={
                            <TouchableOpacity
                                onPress={() => { resetAttach(); setShowHospModal(true); }}
                                style={styles.actionBtn}
                            >
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                                <Text style={styles.actionBtnText}>Add</Text>
                            </TouchableOpacity>
                        }
                    >
                        {hospitalizations.length === 0 && (
                            <EmptyStateCard message="No hospitalizations recorded." />
                        )}
                        {hospitalizations.map((h, idx) => (
                            <ListEntryCard
                                key={h.id || idx}
                                thumbnailUrl={attachUrlFor("hospitalization", h.id)}
                                onThumbnailPress={() => openViewer("hospitalization", h.id)}
                                title={h.title}
                                subtitle={h.date}
                                notes={h.desc}
                                icon={
                                    <Ionicons name="bandage-outline" size={18} color={colors.primary} />
                                }
                                iconBg={colors.tintGreen}
                            />
                        ))}
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
                            url={attachUrl}
                            onChangeUri={setAttachUri}
                            onChangeUrl={setAttachUrl}
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
                            url={attachUrl}
                            onChangeUri={setAttachUri}
                            onChangeUrl={setAttachUrl}
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
                            url={attachUrl}
                            onChangeUri={setAttachUri}
                            onChangeUrl={setAttachUrl}
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

                        <Text style={styles.modalLabel}>
                            Due Date (YYYY-MM-DD)
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="2026-12-16"
                            value={vaxDue}
                            onChangeText={setVaxDue}
                        />

                        <PhotoAttach
                            required
                            uri={attachUri}
                            url={attachUrl}
                            onChangeUri={setAttachUri}
                            onChangeUrl={setAttachUrl}
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
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
    },
    careTeamHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    careTeamTitle: {
        fontSize: 13,
        fontWeight: "750",
        color: colors.primary,
        marginLeft: 6,
    },
    careTeamText: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: 24,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: "center",
    },
    tabButtonActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    tabButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primary,
        fontWeight: "750",
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
        borderRadius: 10,
        overflow: "hidden",
        marginLeft: 8,
        borderWidth: 1,
        borderColor: "#ECE9E4",
        backgroundColor: colors.surfaceAlt,
    },
    vaxThumb: { width: "100%", height: "100%" },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    vaxTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.text,
    },
    vaxTitleCompleted: {
        textDecorationLine: "line-through",
        color: colors.textMuted,
    },
    vaxSub: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    vaxNotes: {
        fontSize: 11,
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
        fontSize: 12,
        fontWeight: "700",
        color: colors.text,
    },
    bulletDesc: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accentStrong,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    actionBtnText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
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
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        fontSize: 12,
        color: colors.text,
    },
    addInlineBtn: {
        paddingHorizontal: 16,
        backgroundColor: colors.primary,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    addInlineBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 12,
    },
    allergyChips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.softCoral,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    chipText: {
        fontSize: 11,
        fontWeight: "600",
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
        borderRadius: 24,
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.primary,
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: colors.textMuted,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 14,
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
        borderRadius: 12,
        backgroundColor: colors.surfaceAlt,
    },
    modalCancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textMuted,
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.accentStrong,
    },
    modalSaveText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
