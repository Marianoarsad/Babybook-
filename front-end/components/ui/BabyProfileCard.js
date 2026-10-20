import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { type } from "../../theme";
import { ProfilePanel, ProfilePhoto, ProfileControl, ProfileMetrics } from "./ProfileVisuals";

export default function BabyProfileCard({ profile, age, measurements, onViewProfile, onChangePhoto, loading, unavailable }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const { width, fontScale } = useWindowDimensions();
    const wide = width >= 700 && fontScale < 1.4;
    const button = <ProfileControl radius={23} onPress={onViewProfile} accessibilityRole="button"
        accessibilityLabel={`View ${profile.name}'s profile`} testID="view-baby-profile"
        style={{ alignSelf: wide ? "flex-start" : "flex-end", maxWidth: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 6 }}>
        <Text style={{ ...type.bodyStrong, color: p.accent, flexShrink: 1 }}>View Profile</Text>
        <Ionicons name="chevron-forward" size={19} color={p.accent} />
    </ProfileControl>;
    return <ProfilePanel testID="baby-profile-card" style={{ marginBottom: 16, gap: 18, flexDirection: wide ? "row" : "column" }}>
        {wide ? <ProfilePhoto key={profile.id} profile={profile} size={156} onChangePhoto={onChangePhoto} /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                {!wide ? <ProfilePhoto key={profile.id} profile={profile} size={width < 360 ? 80 : 88} onChangePhoto={onChangePhoto} /> : null}
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    {!wide ? button : null}
                    <Text style={{ ...type.heading, fontSize: 23, lineHeight: 29, color: p.text }}>{profile.name}</Text>
                    <Text style={{ ...type.body, color: p.secondary }}>{age || "Age not recorded"}</Text>
                </View>
                {wide ? button : null}
            </View>
            <ProfileMetrics measurements={measurements} loading={loading} unavailable={unavailable} />
        </View>
    </ProfilePanel>;
}
