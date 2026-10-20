import React, { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { DashboardSurface as Surface } from "./ConsultationsAppointmentsCard";

// Analytical category artwork; SolidFoodIcon remains the shared record identity.
export default function FoodCategoryIcon({ category, size = 48 }) {
    const { colors } = useTheme(), material = colors.solidFoodCategories[category];
    const id = "food-category-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const fill = `url(#${id})`, shine = colors.appointmentDashboard.reflection;
    return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, borderRadius: size / 2, boxShadow: material.shadow }}>
        <Surface colors={material.surface} highlight={colors.appointmentDashboard.highlight} radius={size / 2} />
        <Svg width={size} height={size} viewBox="0 0 48 48" style={{ position: "relative" }}>
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">{(material.art || material.segment).map((color, i) => <Stop key={i} offset={i / 2} stopColor={color} />)}</LinearGradient></Defs>
            {category === "fruits" ? <>
                <Path d="M24 16C13 9 8 20 12 31c3 9 8 9 12 7 6 3 11-1 13-10 2-10-5-16-13-12Z" fill={fill} />
                <Path d="M24 17q-2-6 0-10 M25 12q1-7 10-6-1 8-10 6" stroke={material.ink} strokeWidth="2" strokeLinecap="round" fill={fill} />
                <Ellipse cx="17" cy="21" rx="2" ry="4" fill={shine} opacity="0.7" />
            </> : category === "vegetables" ? <>
                <Path d="M14 39C14 28 19 11 27 14c13 5-3 20-13 25Z" fill={fill} />
                <Path d="M26 15q-1-8 3-10 M29 16q9-6 7-10 M24 14q-7-5-4-9" fill="none" stroke={colors.solidFoodCategories.fruits.segment[2]} strokeWidth="3" strokeLinecap="round" />
                <Path d="m23 20 5 2m-9 5 4 2m-5-9 4-3" stroke={material.ink} strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
                <Path d="m18 30 5-11" stroke={shine} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            </> : category === "grains" ? <>
                <Path d="m16 40 15-32" stroke={material.art[2]} strokeWidth="2" strokeLinecap="round" />
                {[0, 1, 2].map(i => <React.Fragment key={i}><Ellipse cx={20 + i * 4} cy={31 - i * 8} rx="4" ry="7" transform={`rotate(-35 ${20 + i * 4} ${31 - i * 8})`} fill={fill} /><Ellipse cx={29 + i * 3} cy={31 - i * 8} rx="4" ry="7" transform={`rotate(42 ${29 + i * 3} ${31 - i * 8})`} fill={fill} /></React.Fragment>)}
                <Path d="m19 28 5-12" stroke={shine} strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
            </> : category === "proteins" ? <>
                <Path d="M12 22C18 10 33 9 38 19s-7 19-19 19C8 38 7 31 12 22Z" fill={fill} stroke={shine} strokeWidth="2" />
                <Path d="M15 23c4-8 15-9 19-3s-6 13-14 13-9-5-5-10Z" fill="none" stroke={shine} strokeWidth="1.5" opacity="0.75" />
                <Ellipse cx="28" cy="21" rx="4" ry="3" fill={shine} opacity="0.85" />
            </> : category === "dairy" ? <>
                <Path d="M15 14h18l5 9v16H12V23Z" fill={fill} />
                <Path d="M15 9h18v5H15Z M24 14v25" fill={fill} stroke={material.art[2]} strokeWidth="1" />
                <Path d="M13 24h10v13H13Z M16 16h7l-6 7h-4Z" fill={shine} opacity="0.85" />
                <Path d="M17 10h12" stroke={shine} strokeWidth="1.5" opacity="0.7" />
            </> : [15, 24, 33].map(x => <React.Fragment key={x}><Circle cx={x} cy="25" r="3.2" fill={fill} /><Circle cx={x - 1} cy="24" r="1" fill={shine} opacity="0.7" /></React.Fragment>)}
        </Svg>
    </View>;
}
