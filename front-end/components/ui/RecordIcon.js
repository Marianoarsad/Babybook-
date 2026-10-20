import VaccineIcon from "./VaccineIcon";
import MilkIcon from "./MilkIcon";
import SolidFoodIcon from "./SolidFoodIcon";
import MilestoneIcon from "./MilestoneIcon";
import React, { memo, useId } from "react";
import { Image, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import Gradient from "./Gradient";
import AllRecordsIcon from "./AllRecordsIcon";
export { default as AllRecordsIcon } from "./AllRecordsIcon";

export const ALLERGY_ARTWORK = require("../../assets/profile/allergies.png");

function IconSurface({ size, tone, showBackground, children }) {
    const { colors } = useTheme(), p = colors.profileSurface;
    return <View accessible={false} pointerEvents="none" style={{ width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: showBackground ? p.iconShadow : undefined }}>
        {showBackground ? <Gradient accessible={false} pointerEvents="none" colors={p.icon[tone]}
            style={{ position: "absolute", inset: 0, borderRadius: size / 2, boxShadow: `inset 0 2px 2px ${p.highlight}` }} /> : null}
        {children}
    </View>;
}

export const AllergyIcon = memo(function AllergyIcon({ size = 40, showBackground = true }) {
    return <IconSurface size={size} tone="mint" showBackground={showBackground}>
        <Image source={ALLERGY_ARTWORK} resizeMode="contain" accessible={false} style={{ width: size * 0.84, height: size * 0.84 }} />
    </IconSurface>;
});

function PurpleArtwork({ size, showBackground, dna }) {
    const { colors } = useTheme(), art = colors.conditionArtwork;
    const id = "condition-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return <IconSurface size={size} tone="lavender" showBackground={showBackground}>
        <Svg style={{ position: "relative" }} accessible={false} aria-hidden pointerEvents="none" width={size * 0.84} height={size * 0.84} viewBox="0 0 100 100">
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                {art.purple.map((color, i) => <Stop key={color} offset={i / 2} stopColor={color} />)}
            </LinearGradient></Defs>
            {dna ? <>
                <Path d="M35 15C23 38 77 42 65 85M65 15C77 38 23 62 35 85" fill="none" stroke={art.purple[2]} strokeWidth="10" strokeLinecap="round" opacity="0.2" transform="translate(1 3)" />
                {[ [36,22,65,22], [39,33,60,37], [43,44,54,49], [45,57,59,61], [36,70,64,75] ].map((line,i) => <Path key={i}
                    d={`M${line[0]} ${line[1]}L${line[2]} ${line[3]}`} stroke={`url(#${id})`} strokeWidth="6" strokeLinecap="round" />)}
                <Path d="M35 15C23 38 77 42 65 85M65 15C77 38 23 62 35 85" fill="none" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round" />
                <Path d="M33 18C28 31 42 39 49 44M64 18C69 31 56 39 49 45M38 68L34 80" fill="none" stroke={art.reflection} strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
            </> : <>
                <Path d="M41 22a10 10 0 0 1 20 0v36a19 19 0 1 1-20 0Z" fill={art.purple[2]} opacity="0.18" transform="translate(1 3)" />
                <Path d="M40 20a10 10 0 0 1 20 0v36a19 19 0 1 1-20 0Z" fill={`url(#${id})`} />
                <Path d="M44 53V21a6 6 0 0 1 12 0v38a14 14 0 1 1-12 0" fill="none" stroke={art.reflection} strokeWidth="3" opacity="0.85" strokeLinecap="round" />
                <Path d="M50 35v31" stroke={art.purple[2]} strokeWidth="5" strokeLinecap="round" />
                <Circle cx="50" cy="72" r="9" fill={art.purple[2]} />
                <Path d="M45 70q0-5 5-5M66 29h5M66 40h5M66 51h5" fill="none" stroke={art.purple[0]} strokeWidth="3" strokeLinecap="round" />
            </>}
        </Svg>
    </IconSurface>;
}
export const HereditaryIcon = memo(function HereditaryIcon({ size = 40, showBackground = true }) { return <PurpleArtwork size={size} showBackground={showBackground} dna />; });
export const IllnessIcon = memo(function IllnessIcon({ size = 40, showBackground = true }) { return <PurpleArtwork size={size} showBackground={showBackground} />; });

// Canonical record identifiers reuse the approved shared category artwork.
export const recordIconRegistry = Object.freeze({ all: AllRecordsIcon, Illness: IllnessIcon, Allergy: AllergyIcon, "Hereditary Condition": HereditaryIcon, vaccination: VaccineIcon, milk: MilkIcon, "milk-type-periods": MilkIcon, solid: SolidFoodIcon, milestone: MilestoneIcon, milestones: MilestoneIcon });
export default function RecordIcon({ category, ...props }) {
    const Icon = recordIconRegistry[category];
    return Icon ? <Icon {...props} /> : null;
}
