import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { space } from "../theme";
import { api } from "../utils/api";
import { memoryToApp } from "../utils/adapters";
import { MemoryVisualCard, EmptyStateCard } from "./common/Cards";
import MemoryDetail from "./MemoryDetail";

// "See all" destination for Dashboard's Photo Memories section (which shows
// only the 4 most recent). Reuses MemoryVisualCard, the same card component
// Growth.js already uses for a near-identical photo+caption layout.
export default function AllMemories({ profile, onClose }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailMemory, setDetailMemory] = useState(null);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const rows = await api.listRecords(profile.id, "memories");
                if (active) setMemories(rows.map(memoryToApp));
            } catch (e) {
                console.log("load all memories:", e.message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.headerBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Milestone Memories</Text>
                <View style={styles.headerBtn} />
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <Text style={styles.loadingText}>Loading…</Text>
                ) : memories.length === 0 ? (
                    <EmptyStateCard message="No memories yet." icon="image-outline" />
                ) : (
                    memories.map((m, idx) => (
                        <MemoryVisualCard
                            key={m.id || idx}
                            title={m.title}
                            description={m.description}
                            date={m.date}
                            photoUrl={m.photoUrl}
                            onClick={() => setDetailMemory(m)}
                        />
                    ))
                )}
            </ScrollView>
            <MemoryDetail
                visible={!!detailMemory}
                memory={detailMemory}
                dob={profile.dateOfBirth}
                typeLabel="Photo Memory"
                onClose={() => setDetailMemory(null)}
            />
        </View>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
        headerTitle: { fontSize: 18, fontWeight: "800", color: colors.primary },
        content: { padding: space.lg, paddingBottom: space.xxl },
        loadingText: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: space.xl },
    });
