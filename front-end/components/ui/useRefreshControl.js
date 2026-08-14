import React from "react";
import { Platform, RefreshControl } from "react-native";
import { useTheme } from "../../context/ThemeContext";

// Pull-to-refresh, wired to the active child's palette. A hook rather than a
// wrapper component because target screens have inconsistent ScrollView
// shapes (ShareRecords.js has two return branches, CalendarView.js's
// ScrollView is mid-tree) — a hook drops into any existing
// `<ScrollView refreshControl={...}>` with no JSX restructuring.
//
// Returns undefined on web on purpose: react-native-web's RefreshControl
// strips onRefresh/refreshing/tintColor down to a bare View (verified in
// node_modules/react-native-web/dist/exports/RefreshControl/index.js), and
// ScrollView.js there clones it with the ScrollView's own `style`, doubling
// it on the wrapper. Passing refreshControl={undefined} is a plain
// ScrollView on web — no bug, no dead spinner.
export function useRefreshControl(refreshing, onRefresh) {
    const { colors } = useTheme();
    if (Platform.OS === "web") return undefined;
    return (
        <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
        />
    );
}
