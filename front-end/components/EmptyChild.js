import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { space, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import Field from "./ui/Field";

import DateField, { MeasurementField } from "./ui/DateField";
import { useToast } from "./ui/Toast";
import RecordFormSheet, { RecordFormGroup } from "./ui/RecordFormSheet";
import { stripDoctorPrefix } from "../utils/adapters";

// Shown when an authenticated parent has no children yet.
// Progressive disclosure: required fields first, optional details behind a toggle.
export default function EmptyChild({ parentName, onCreate, onLogOut }) {
    const toast = useToast();
    const { colors } = useTheme();
    const [name, setName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("girl");
    const [weight, setWeight] = useState("");
    const [height, setHeight] = useState("");
    const [bloodType, setBloodType] = useState("");
    const [hospital, setHospital] = useState("");
    const [pediatrician, setPediatrician] = useState("");
    const [obgyne, setObgyne] = useState("");
    const [emergencyFirstName, setEmergencyFirstName] = useState("");
    const [emergencyLastName, setEmergencyLastName] = useState("");
    const [emergencyRelationship, setEmergencyRelationship] = useState("");
    const [emergencyNumber, setEmergencyNumber] = useState("");
    const [showMore, setShowMore] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState("");

    const submit = async () => {
        if (!name.trim()) {
            setNameError("Please enter your baby's name");
            return;
        }
        setNameError("");
        setSaving(true);
        try {
            await onCreate({
                name,
                dateOfBirth: dob,
                gender,
                weight,
                height,
                bloodType,
                hospital,
                pediatrician,
                obgyne,
                emergencyContactDetails: {
                    firstName: emergencyFirstName,
                    lastName: emergencyLastName,
                    relationship: emergencyRelationship,
                    contactNumber: emergencyNumber,
                },
            });
        } catch (e) {
            toast.error(e.message || "Could not add child");
        } finally {
            setSaving(false);
        }
    };

    return (
        <RecordFormSheet visible title={`Welcome${parentName ? `, ${parentName}` : ""}!`}
            cancelLabel="Log out" submitLabel="Create Profile" onClose={onLogOut} onSubmit={submit}
            busy={saving} error={nameError} dismissible={false}>
            <RecordFormGroup>
                <View
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: radius.lg,
                        borderCurve: "continuous",
                        backgroundColor: colors.softGreen,
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        marginBottom: space.sm,
                    }}
                >
                    <Ionicons name="happy-outline" size={30} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: space.lg }}>
                    Let's add your first child to start their BabyBook+.
                </Text>

                <Field
                    label="Baby's Full Name"
                    placeholder="e.g. Maya Chen"
                    value={name}
                    onChangeText={(t) => {
                        setName(t);
                        if (nameError) setNameError("");
                    }}
                    error={nameError}
                />

                <DateField label="Date of Birth" value={dob} onChange={setDob} />

                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: space.xs }}>
                    Sex
                </Text>
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        borderCurve: "continuous",
                        padding: space.xs,
                        marginBottom: space.md,
                    }}
                >
                    {[
                        { key: "girl", label: "Girl" },
                        { key: "boy", label: "Boy" },
                    ].map((opt) => {
                        const on = gender === opt.key;
                        return (
                            <TouchableOpacity
                                key={opt.key}
                                onPress={() => setGender(opt.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                style={{
                                    flex: 1,
                                    minHeight: 40,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: radius.sm,
                                    backgroundColor: on ? colors.surface : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: on ? "800" : "600", color: on ? colors.primary : colors.textMuted }}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <MeasurementField label="Birth Weight" unit="kg" min={0.3} max={40} defaultValue={3.2} value={weight} onChange={setWeight} />
                <MeasurementField label="Birth Height" unit="cm" min={20} max={140} defaultValue={49} value={height} onChange={setHeight} />

                <TouchableOpacity
                    onPress={() => setShowMore((s) => !s)}
                    accessibilityRole="button"
                    style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingVertical: space.sm }}
                >
                    <Ionicons name={showMore ? "chevron-down" : "chevron-forward"} size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                        Add health details (optional)
                    </Text>
                </TouchableOpacity>

                {showMore ? (
                    <View>
                        <Field label="Blood Type" placeholder="e.g. O+" autoCapitalize="characters" value={bloodType} onChangeText={setBloodType} />
                        <Field label="Birth Hospital" value={hospital} onChangeText={setHospital} />
                        <Field label="Pediatrician" prefix="Dr." placeholder="Doctor's name"
                            value={pediatrician} onChangeText={(value) => setPediatrician(stripDoctorPrefix(value))}
                            autoCapitalize="words" />
                        <Field label="OB-GYNE" prefix="Dr." placeholder="Doctor's name"
                            value={obgyne} onChangeText={(value) => setObgyne(stripDoctorPrefix(value))}
                            autoCapitalize="words" />
                        <Field label="Emergency Contact First Name" placeholder="First name"
                            value={emergencyFirstName} onChangeText={setEmergencyFirstName} autoCapitalize="words" />
                        <Field label="Emergency Contact Last Name" placeholder="Last name"
                            value={emergencyLastName} onChangeText={setEmergencyLastName} autoCapitalize="words" />
                        <Field label="Emergency Contact Relationship" placeholder="e.g. Mother"
                            value={emergencyRelationship} onChangeText={setEmergencyRelationship} autoCapitalize="words" />
                        <Field label="Emergency Contact Number" placeholder="Contact number"
                            value={emergencyNumber} onChangeText={setEmergencyNumber}
                            numericMode="digits" keyboardType="phone-pad" textContentType="telephoneNumber" />
                    </View>
                ) : null}

            </RecordFormGroup>
        </RecordFormSheet>
    );
}
