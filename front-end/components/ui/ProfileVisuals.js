import React, { useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { MIN_TOUCH, type } from "../../theme";
import { shortDate } from "../../utils/dates";
import Gradient from "./Gradient";
import { GrowthMetricIcon } from "./GrowthVisuals";
import { AllergyIcon, HereditaryIcon } from "./RecordIcon";
import useSoftPress from "./useSoftPress";

const PROFILE_ARTWORK = {
    growth: require("../../assets/navbar/growth-blue.png"),
    blood: require("../../assets/profile/blood.png"),
    edit: require("../../assets/profile/edit.png"),
    ped: require("../../assets/profile/pediatrician.png"),
    emergency: require("../../assets/profile/emergency.png"),
};

export function ProfileSurface({ colors, radius = 24, highlight }) {
    return <Gradient pointerEvents="none" accessible={false} colors={colors}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, boxShadow: `inset 0 2px 2px ${highlight}` }]} />;
}

export const ProfileControl = React.forwardRef(function ProfileControl({ kind = "surface", radius = 24, children, style, ...props }, ref) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const { respond, transform } = useSoftPress();
    const [focused, setFocused] = useState(false);
    const [pressed, setPressed] = useState(false);
    const focus = event => setFocused(Platform.OS === "web" && Boolean(event.currentTarget?.matches?.(":focus-visible")));
    const press = down => { setPressed(down); respond(down); };
    return <Pressable ref={ref} {...props} onPressIn={() => press(true)} onPressOut={() => press(false)}
        onFocus={focus} onKeyDown={focus} onBlur={() => { setFocused(false); press(false); }}
        style={[{ minHeight: MIN_TOUCH, borderRadius: radius }, style, !kind && pressed && { opacity: 0.72 }, Platform.OS === "web" && {
            outlineStyle: focused ? "solid" : "none", outlineWidth: 2, outlineOffset: 3, outlineColor: p.accent }]}>
        {kind ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: radius,
            backgroundColor: p[kind][0], boxShadow: pressed ? p.pressedShadow : p.itemShadow, transform }]}>
            <ProfileSurface colors={p[kind]} radius={radius} highlight={p.highlight} />
        </Animated.View> : null}
        {children}
    </Pressable>;
});

export function ProfileIcon({ kind, name, tone = "blue", size = 44 }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    if (kind === "allergies") return <AllergyIcon size={size} />;
    if (kind === "hereditary") return <HereditaryIcon size={size} />;
    return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: p.iconShadow }}>
        <ProfileSurface colors={p.icon[tone]} radius={size / 2} highlight={p.highlight} />
        {PROFILE_ARTWORK[kind] ? <Image source={PROFILE_ARTWORK[kind]} resizeMode="contain" accessible={false}
            style={{ width: size * 0.84, height: size * 0.84 }} /> : <Ionicons name={name} size={23} color={p.glyph[tone]} />}
    </View>;
}

export function ProfilePanel({ children, kind = "panel", style, radius = 26, ...props }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    return <View {...props} style={[{ borderRadius: radius, backgroundColor: p[kind][0],
        boxShadow: kind === "panel" ? p.panelShadow : p.itemShadow, padding: 16, gap: 12 }, style]}>
        <ProfileSurface colors={p[kind]} radius={radius} highlight={p.highlight} />
        {children}
    </View>;
}

export function ProfilePhoto({ profile, size = 88, onChangePhoto }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const [failedUrl, setFailedUrl] = useState(null);
    const url = profile.hasRecordedAvatar !== false && profile.avatarUrl;
    return <View style={{ width: size, height: size, flexShrink: 0, marginBottom: 4 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, padding: 5,
            backgroundColor: p.avatarRing, boxShadow: p.itemShadow }}>
            <ProfileSurface colors={p.edit} radius={size / 2} highlight={p.highlight} />
            {url && failedUrl !== url ? <Image source={{ uri: url }} onError={() => setFailedUrl(url)}
                accessibilityLabel={`${profile.name}'s profile photo`}
                style={{ width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }} />
                : <View accessibilityLabel={`${profile.name}'s profile photo placeholder`}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person" size={size * 0.4} color={p.accent} />
                </View>}
        </View>
        <ProfileControl kind="edit" radius={22} onPress={onChangePhoto} accessibilityRole="button"
            accessibilityLabel={`Change ${profile.name}'s photo`} style={{ position: "absolute", right: -3, bottom: -4,
                width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="camera" size={23} color={p.accent} />
        </ProfileControl>
    </View>;
}

export function ProfileMetrics({ measurements, showDates = false, headLabel = "Head", loading = false, unavailable = false }) {
    const { colors } = useTheme();
    const p = colors.profileSurface;
    const { width, fontScale } = useWindowDimensions();
    const stacked = fontScale > 1.3 && width / fontScale < 300;
    return <View testID="profile-metrics" style={{ flexDirection: stacked ? "column" : "row", gap: stacked ? 16 : 0 }}>
        {measurements.map((m, index) => <View key={m.key} testID={`profile-metric-${m.key}`} accessible
            accessibilityLabel={`${m.label}: ${m.value != null ? `${m.value} ${m.unit}, measured ${shortDate(m.date)}` : loading ? "Loading" : unavailable ? "Unavailable" : "Not recorded"}`}
            style={{ flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 3, gap: 6,
                borderLeftWidth: index && !stacked ? 1 : 0, borderLeftColor: p.divider }}>
            <GrowthMetricIcon metric={m.key} circular size={width < 360 ? 44 : 52} />
            <Text style={{ ...type.bodyStrong, fontSize: 17, lineHeight: 24, color: p.text, textAlign: "center", alignSelf: "stretch", ...(Platform.OS === "web" ? { overflowWrap: "anywhere" } : {}) }}>
                {m.value != null ? <>{String(m.value)}<Text style={{ fontSize: 13 }}> {m.unit}</Text></> : "\u2014"}
            </Text>
            <Text style={{ ...type.caption, color: p.secondary, textAlign: "center", alignSelf: "stretch", ...(Platform.OS === "web" ? { overflowWrap: "anywhere" } : {}) }}>{m.key === "head" ? headLabel : m.label}</Text>
            {showDates && m.date ? <Text style={{ ...type.caption, color: p.secondary, textAlign: "center" }}>{shortDate(m.date)}</Text> : null}
        </View>)}
    </View>;
}
