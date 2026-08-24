import React, { useState, useEffect } from "react";
import { View, Text, Image } from "react-native";
import { type } from "../../theme";
import { useTheme } from "../../context/ThemeContext";

// The account holder's picture, with the parent's own initials behind it.
//
// This replaced PREDEFINED_AVATARS in EditProfile.js: four Unsplash photographs
// of strangers, offered as the only way to have a picture at all. The default
// was one of them, so a parent who never opened Edit Profile was represented
// across the app — side menu, profile, header — by a photograph of somebody
// else. That is the same fabrication the project removed from the Care Team
// card ("Dr. Sarah Chen") and the milestone checklist's stock baby photos: an
// invented fact presented in the place a real one belongs.
//
// Initials are not a placeholder for a photo. They are the parent's own name,
// which is a fact the app actually holds, and they carry no claim at all.
//
// The onError fallback is the same one Dashboard.js uses for child avatars
// (Dashboard.js:919), for the same reason: uploads sit on an ephemeral
// filesystem, so a truthy-but-dead URL must fall back rather than render an
// empty circle.
export function initialsFor(name) {
    const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return "";
    // First and last, so "Maria Josefa Rivera" reads MR rather than MJ — the
    // surname is the half that distinguishes two people in a household.
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

export default function Avatar({ uri, name, size = 64, borderWidth = 0, style }) {
    const { colors } = useTheme();
    const [broken, setBroken] = useState(false);

    // A new URL deserves a fresh attempt; without this, one failed load would
    // keep the fallback showing even after the parent picked a different photo.
    useEffect(() => setBroken(false), [uri]);

    const base = {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor: colors.primary,
    };
    const initials = initialsFor(name);

    if (uri && !broken) {
        return <Image source={{ uri }} style={[base, style]} onError={() => setBroken(true)} />;
    }

    return (
        <View
            style={[
                base,
                { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
                style,
            ]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={name ? `${name}'s profile picture` : "Profile picture"}
        >
            <Text
                style={{
                    ...type.bodyStrong,
                    // Scales with the circle so one component serves the 32px
                    // side-menu avatar and the 104px one on Edit Profile.
                    fontSize: Math.round(size * 0.38),
                    lineHeight: Math.round(size * 0.46),
                    color: colors.primary,
                }}
            >
                {initials}
            </Text>
        </View>
    );
}
