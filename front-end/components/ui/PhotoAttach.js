import React from "react";
import { View, Text, TextInput, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import { pickImage, pickerAvailable } from "../../utils/imagePicker";

// Required supporting-photo picker used inside health-record add/edit modals.
// Manages one image, provided either as a device URI (uploaded on save) or a
// pasted URL. The parent enforces "required" before allowing save.
export default function PhotoAttach({
    uri,
    url,
    onChangeUri,
    onChangeUrl,
    required = true,
    label = "Supporting Photo",
    helper = "e.g. vaccination sticker, prescription, or record photo",
}) {
    const { colors } = useTheme();
    const preview = uri || url || "";
    return (
        <View style={{ marginBottom: space.md }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: 6 }}>
                {label}
                {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <TouchableOpacity
                    onPress={async () => {
                        if (!pickerAvailable()) return;
                        const picked = await pickImage();
                        if (picked) {
                            onChangeUri(picked);
                            onChangeUrl("");
                        }
                    }}
                    style={{
                        width: 66,
                        height: 66,
                        borderRadius: radius.md,
                        borderCurve: "continuous",
                        borderWidth: 1,
                        borderColor: preview ? colors.border : colors.borderStrong,
                        borderStyle: preview ? "solid" : "dashed",
                        backgroundColor: colors.surfaceAlt,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Choose supporting photo"
                >
                    {preview ? (
                        <Image source={{ uri: preview }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                        <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                    )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                        {uri ? "Photo selected ✓" : pickerAvailable() ? "Tap the box to choose a photo," : helper}
                    </Text>
                    <TextInput
                        placeholder="or paste an image URL"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={url}
                        onChangeText={(v) => {
                            onChangeUrl(v);
                            if (v) onChangeUri("");
                        }}
                        style={{
                            height: 42,
                            backgroundColor: colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: radius.sm,
                            borderCurve: "continuous",
                            paddingHorizontal: space.sm,
                            fontSize: 13,
                            color: colors.text,
                        }}
                    />
                </View>
            </View>
        </View>
    );
}
