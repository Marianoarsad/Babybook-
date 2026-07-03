import React from "react";
import { Modal, View, Image, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space, radius } from "../../theme";

// Full-screen image viewer for "View Full Image" on a record attachment.
// Optional onReplace / onDelete render action buttons (used for saved records).
export default function ImageViewer({ visible, uri, onClose, onReplace, onDelete }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.92)",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: space.lg,
                }}
            >
                <TouchableOpacity
                    onPress={onClose}
                    style={{
                        position: "absolute",
                        top: 48,
                        right: 20,
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "rgba(255,255,255,0.16)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Close image"
                >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                {uri ? (
                    <Image source={{ uri }} style={{ width: "100%", height: "72%" }} resizeMode="contain" />
                ) : (
                    <Text style={{ color: "#FFFFFF" }}>No image</Text>
                )}

                {(onReplace || onDelete) && (
                    <View style={{ flexDirection: "row", gap: space.md, marginTop: space.xl }}>
                        {onReplace ? (
                            <TouchableOpacity
                                onPress={onReplace}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    backgroundColor: "rgba(255,255,255,0.16)",
                                    paddingVertical: 10,
                                    paddingHorizontal: space.lg,
                                    borderRadius: radius.pill,
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Replace photo"
                            >
                                <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
                                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Replace</Text>
                            </TouchableOpacity>
                        ) : null}
                        {onDelete ? (
                            <TouchableOpacity
                                onPress={onDelete}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    backgroundColor: "rgba(220,38,38,0.85)",
                                    paddingVertical: 10,
                                    paddingHorizontal: space.lg,
                                    borderRadius: radius.pill,
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Delete photo"
                            >
                                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Delete</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}
            </View>
        </Modal>
    );
}
