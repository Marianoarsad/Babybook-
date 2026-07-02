import React from "react";
import { ScrollView, View } from "react-native";
import { colors } from "../../theme";
import { useResponsive } from "../../utils/responsive";

// Adaptive page container. Centers content and caps its width on tablets/desktops
// (so lines don't stretch and the layout doesn't feel empty), while filling the
// screen on phones. Use as the root of every screen.
export default function Screen({
    children,
    scroll = true,
    background = colors.background,
    maxWidth,
    contentStyle,
}) {
    const { contentMaxWidth, gutter } = useResponsive();

    const inner = (
        <View
            style={{
                width: "100%",
                maxWidth: maxWidth || contentMaxWidth,
                alignSelf: "center",
                paddingHorizontal: gutter,
            }}
        >
            {children}
        </View>
    );

    if (!scroll) {
        return (
            <View style={{ flex: 1, backgroundColor: background }}>{inner}</View>
        );
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={[{ paddingVertical: gutter, flexGrow: 1 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
        >
            {inner}
        </ScrollView>
    );
}
