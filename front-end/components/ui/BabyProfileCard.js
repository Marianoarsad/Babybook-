import React from "react";
import { Platform, View, Text, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { ProfilePanel, ProfilePhoto, ProfileControl, ProfileMetrics } from "./ProfileVisuals";

export default function BabyProfileCard({ profile, age, measurements, onViewProfile, onChangePhoto, loading, unavailable }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const { width } = useWindowDimensions();
    const narrow = width < 360;
    const wide = width >= 700;
    const wrap = Platform.OS === "web" ? { overflowWrap: "anywhere" } : {};
    return <ProfilePanel testID="baby-profile-card" style={{ marginBottom: 16,
        paddingHorizontal: wide ? 24 : narrow ? 16 : 20, paddingVertical: narrow ? 16 : 18,
        gap: wide ? 20 : narrow ? 16 : 18 }}>
        <View testID="baby-profile-identity" style={{ flexDirection: "row", alignItems: "center", gap: wide ? 16 : narrow ? 10 : 14 }}>
            <ProfilePhoto key={profile.id} profile={profile} size={wide ? 96 : narrow ? 64 : 72} onChangePhoto={onChangePhoto} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={{ ...type.title, ...wrap, fontSize: wide ? 24 : narrow ? 18 : 20,
                    lineHeight: wide ? 30 : narrow ? 23 : 25, color: p.text }}>{profile.name}</Text>
                <Text style={{ ...type.body, ...wrap, fontSize: wide ? 16 : narrow ? 13 : 14,
                    lineHeight: wide ? 22 : narrow ? 18 : 20, color: p.secondary }}>{age || "Age not recorded"}</Text>
            </View>
            <ProfileControl radius={23} onPress={onViewProfile} accessibilityRole="button"
                accessibilityLabel={`View ${profile.name}'s profile`} testID="view-baby-profile"
                style={{ alignSelf: "flex-start", flexShrink: 0, width: wide ? 132 : narrow ? 96 : 108,
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    paddingHorizontal: wide ? 10 : 6, paddingVertical: 8, gap: wide ? 6 : 4 }}>
                <Text style={{ ...type.label, ...wrap, fontSize: wide ? 14 : 13, lineHeight: wide ? 18 : 17,
                    color: p.accent, flexShrink: 1, minWidth: 0, textAlign: "center" }}>View Profile</Text>
                <Ionicons name="chevron-forward" size={wide ? 17 : 14} color={p.accent} />
            </ProfileControl>
        </View>
        <ProfileMetrics compact measurements={measurements} loading={loading} unavailable={unavailable} />
    </ProfilePanel>;
}
