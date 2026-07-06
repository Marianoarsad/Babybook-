import React from "react";
import { View } from "react-native";

// Guarded so the app still runs if expo-linear-gradient isn't installed yet.
let LinearGradient = null;
try {
    // eslint-disable-next-line global-require
    LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch (e) {
    LinearGradient = null;
}

// Linear gradient fill. Uses expo-linear-gradient when available; otherwise
// falls back to a solid View using the first color, so nothing crashes.
export default function Gradient({
    colors = ["#EC4F96", "#FF7EB3"],
    style,
    start,
    end,
    children,
    ...rest
}) {
    if (LinearGradient) {
        return (
            <LinearGradient
                colors={colors}
                start={start || { x: 0, y: 0 }}
                end={end || { x: 1, y: 1 }}
                style={style}
                {...rest}
            >
                {children}
            </LinearGradient>
        );
    }
    return (
        <View style={[style, { backgroundColor: colors[0] }]} {...rest}>
            {children}
        </View>
    );
}
