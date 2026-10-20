import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { fullMonthDate } from "../../utils/dates";

export default function MemoryDateRow({ date }) {
    const { colors } = useTheme();
    if (!date) return null;
    return <View style={styles.row}>
        <Image accessible={false} source={require("../../assets/navbar/calendar-blue.png")} resizeMode="contain" style={styles.icon} />
        <Text style={[styles.date, { color: colors.memoriesSurface.secondary }]}>{fullMonthDate(date) || "Date unavailable"}</Text>
    </View>;
}
const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    icon: { width: 16, height: 16, flexShrink: 0 },
    date: { ...type.caption, flex: 1, minWidth: 0 },
});
