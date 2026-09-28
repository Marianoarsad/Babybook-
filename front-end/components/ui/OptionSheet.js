import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { space, type, MIN_TOUCH } from "../../theme";
import { useTheme } from "../../context/ThemeContext";
import AnchoredMenu, { AnchoredMenuItem } from "./AnchoredMenu";

// A scrolling anchored selector for longer input-bound lists. It shares the
// same trigger-width, backdrop-free fold as every compact select while keeping
// the current choice near the visible portion of a long list.
export default function OptionSheet({
    visible,
    anchor,
    title,
    options = [],
    selectedKey,
    onSelect,
    onClose,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const selectedIndex = options.findIndex((option) => option.key === selectedKey);
    const initialScrollOffset = selectedIndex > 0
        ? (title ? MIN_TOUCH : 0) + Math.max(0, selectedIndex - 1) * MIN_TOUCH
        : 0;

    return (
        <AnchoredMenu
            visible={visible && !!anchor}
            anchor={anchor}
            onClose={onClose}
            variant="select"
            initialScrollOffset={initialScrollOffset}
        >
            {title ? (
                <View style={styles.header}>
                    <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
                        {title}
                    </Text>
                </View>
            ) : null}
            {options.map((option) => (
                <AnchoredMenuItem
                    key={String(option.key)}
                    label={option.label}
                    note={option.note}
                    selected={option.key === selectedKey}
                    variant="select"
                    onPress={() => onSelect(option.key)}
                    accessibilityLabel={option.note ? `${option.label}, ${option.note}` : option.label}
                />
            ))}
        </AnchoredMenu>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    header: {
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: space.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
    },
    title: { ...type.label, color: colors.text },
});
