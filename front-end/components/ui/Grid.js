import React from "react";
import { View } from "react-native";
import { space } from "../../theme";
import { useResponsive } from "../../utils/responsive";

// Responsive grid: 1 column on phones, 2 on tablets, 3 on desktops.
// Children wrap evenly with a consistent gap. Use for card sections
// (widgets, memories, clinics, etc.) so they use the width on big screens.
export default function Grid({ children, gap = space.md, columns: fixedColumns }) {
    const { columns: autoColumns } = useResponsive();
    const columns = fixedColumns || autoColumns;
    const items = React.Children.toArray(children).filter(Boolean);
    const basis = `${100 / columns}%`;

    return (
        <View
            style={{
                flexDirection: "row",
                flexWrap: "wrap",
                marginHorizontal: -gap / 2,
            }}
        >
            {items.map((child, i) => (
                <View key={i} style={{ width: basis, paddingHorizontal: gap / 2, marginBottom: gap }}>
                    {child}
                </View>
            ))}
        </View>
    );
}
