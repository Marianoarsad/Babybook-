import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Image,
    Alert,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import {
    SectionContainerCard,
    ListEntryCard,
    EmptyStateCard,
} from "./common/Cards";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function Health({
    profile,
    onUpdateProfile,
    immunizations,
    setImmunizations,
    feedLogs,
    setFeedLogs,
}) {
    const { language, t } = useLanguage();
    const [activeTab, setActiveTab] = useState("immunizations");

    // Care Team state
    const [pediatrician, setPediatrician] = useState(
        profile.pediatricianName || "Dr. Sarah Chen",
    );
    const [hospital, setHospital] = useState(
        profile.hospital || "St. Jude Medical Center",
    );

    // Medical conditions states
    const [allergies, setAllergies] = useState(
        profile.allergies || ["Penicillin"],
    );
    const [newAllergy, setNewAllergy] = useState("");

    const [illnesses, setIllnesses] = useState([
        {
            id: "il1",
            title: "Infant Colic",
            date: "Jan 2026",
            resolved: true,
            desc: "Tummy sensitivity managed with gentle massage.",
        },
        {
            id: "il2",
            title: "Mild Atopic Eczema",
            date: "Mar 2026",
            resolved: false,
            desc: "Apply moisturizing baby balm twice daily.",
        },
    ]);
    const [showIllnessModal, setShowIllnessModal] = useState(false);
    const [illnessTitle, setIllnessTitle] = useState("");
    const [illnessDesc, setIllnessDesc] = useState("");

    const [medications, setMedications] = useState([
        {
            id: "med1",
            title: "Infant Vitamin D Drops",
            dosage: "400 IU once daily",
            duration: "Ongoing",
        },
        {
            id: "med2",
            title: "Barrier Balm",
            dosage: "Apply to cheeks twice daily",
            duration: "As needed",
        },
    ]);
    const [showMedModal, setShowMedModal] = useState(false);
    const [medTitle, setMedTitle] = useState("");
    const [medDosage, setMedDosage] = useState("");

    const handleToggleVaccine = (id) => {
        setImmunizations((prev) =>
            prev.map((vax) => {
                if (vax.id === id) {
                    return {
                        ...vax,
                        isCompleted: !vax.isCompleted,
                        completedDate: !vax.isCompleted
                            ? new Date().toISOString().split("T")[0]
                            : undefined,
                    };
                }
                return vax;
            }),
        );
    };

    const handleAddAllergy = () => {
        if (!newAllergy.trim()) return;
        const updated = [...allergies, newAllergy.trim()];
        setAllergies(updated);
        onUpdateProfile({
            ...profile,
            allergies: updated,
        });
        setNewAllergy("");
    };

    const handleAddIllness = () => {
        if (!illnessTitle) {
            Alert.alert("Error", "Please enter illness name");
            return;
        }
        const newIll = {
            id: `il-${Date.now()}`,
            title: illnessTitle,
            date: new Date().toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            }),
            resolved: false,
            desc: illnessDesc,
        };
        setIllnesses([newIll, ...illnesses]);
        setShowIllnessModal(false);
        setIllnessTitle("");
        setIllnessDesc("");
        Alert.alert("Success", "Medical condition recorded successfully.");
    };

    const handleAddMedication = () => {
        if (!medTitle) {
            Alert.alert("Error", "Please enter medication name");
            return;
        }
        const newMed = {
            id: `med-${Date.now()}`,
            title: medTitle,
            dosage: medDosage,
            duration: "As prescribed",
        };
        setMedications([newMed, ...medications]);
        setShowMedModal(false);
        setMedTitle("");
        setMedDosage("");
        Alert.alert("Success", "Prescribed medication logged successfully.");
    };

    return (
        <ScrollView style={styles.container}>
            {/* Care Team Banner Card */}
            <View style={styles.careTeamBox}>
                <View style={styles.careTeamHeader}>
                    <Ionicons
                        name="medical-outline"
                        size={20}
                        color="#456155"
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
                    >
                        {immunizations.map((vax, idx) => (
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
                                color="#D97706"
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
                                color="#10B981"
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
                                onPress={() => setShowMedModal(true)}
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
                                title={med.title}
                                subtitle={`Dosage: ${med.dosage}`}
                                label={
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            color: "#78716C",
                                        }}
                                    >
                                        Duration: {med.duration}
                                    </Text>
                                }
                                icon={
                                    <Ionicons
                                        name="flask-outline"
                                        size={18}
                                        color="#456155"
                                    />
                                }
                                iconBg="#E6F4EA"
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
                                        onPress={() => {
                                            const updated = allergies.filter(
                                                (_, i) => i !== index,
                                            );
                                            setAllergies(updated);
                                            onUpdateProfile({
                                                ...profile,
                                                allergies: updated,
                                            });
                                        }}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={14}
                                            color="#EF4444"
                                            style={{ marginLeft: 4 }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {allergies.length === 0 && (
                                <Text style={{ fontSize: 12, color: "#888" }}>
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
                                onPress={() => setShowIllnessModal(true)}
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
                                title={ill.title}
                                subtitle={`${ill.date}  |  ${ill.resolved ? "Resolved" : "Active"}`}
                                notes={ill.desc}
                                icon={
                                    <Ionicons
                                        name="pulse-outline"
                                        size={18}
                                        color="#456155"
                                    />
                                }
                                iconBg="#E6F4EA"
                            />
                        ))}
                    </SectionContainerCard>
                </View>
            )}

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
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFDF9",
        padding: 16,
    },
    careTeamBox: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E7E5E4",
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
        color: "#456155",
        marginLeft: 6,
    },
    careTeamText: {
        fontSize: 11,
        color: "#57534E",
        marginTop: 2,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "#F5F5F4",
        borderRadius: 24,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E7E5E4",
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
        color: "#78716C",
    },
    tabButtonTextActive: {
        color: "#456155",
        fontWeight: "750",
    },
    vaxRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F4",
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: "#456155",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    checkboxChecked: {
        backgroundColor: "#456155",
        borderColor: "#456155",
    },
    vaxTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1C1917",
    },
    vaxTitleCompleted: {
        textDecorationLine: "line-through",
        color: "#A8A29E",
    },
    vaxSub: {
        fontSize: 11,
        color: "#78716C",
        marginTop: 2,
    },
    vaxNotes: {
        fontSize: 11,
        fontStyle: "italic",
        color: "#456155",
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
        color: "#1C1917",
    },
    bulletDesc: {
        fontSize: 11,
        color: "#78716C",
        marginTop: 2,
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FF8A7A",
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
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        fontSize: 12,
        color: "#1C1917",
    },
    addInlineBtn: {
        paddingHorizontal: 16,
        backgroundColor: "#456155",
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
        backgroundColor: "#FFF1F0",
        borderWidth: 1,
        borderColor: "#FFD3CE",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    chipText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#EF4444",
    },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: "#FFFDF9",
        borderRadius: 24,
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: "#E7E5E4",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#456155",
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#78716C",
        textTransform: "uppercase",
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 14,
        color: "#1C1917",
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
        backgroundColor: "#F5F5F4",
    },
    modalCancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#78716C",
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: "#FF8A7A",
    },
    modalSaveText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
