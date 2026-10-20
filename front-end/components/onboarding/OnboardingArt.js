import React from "react";
import { Image } from "react-native";

// Illustrations for the welcome carousel (components/Onboarding.js). Each
// transparent asset shares the same modern, rounded mobile-product
// illustration language and is contained within this fixed-height art slot.
export const ART_H = 250;

// Slide 1 — a modern open-book dashboard that keeps the baby's health,
// growth, and memory records organized in one place.
export function BookCollage() {
    return (
        <Image
            source={require("../../assets/onboarding-book-collage.png")}
            style={{ width: 316, height: 230 }}
            resizeMode="contain"
            accessible
            accessibilityLabel="A modern open BabyBook dashboard with vaccine, checkup, illness, growth, and memory cards"
        />
    );
}

// Slide 2 — secure, temporary QR consultation access shown on a modern phone.
export function QrShareArt() {
    return (
        <Image
            source={require("../../assets/onboarding-qr-hand.png")}
            style={{ width: 250, height: 250 }}
            resizeMode="contain"
            accessible
            accessibilityLabel="A hand holding a modern BabyBook consultation QR with read-only lock and access timer"
        />
    );
}

// Slide 3 — a guardian and baby protected behind their open BabyBook,
// bringing organization and parent-controlled sharing into one final promise.
export function CareCircleArt() {
    return (
        <Image
            source={require("../../assets/onboarding-care-circle.png")}
            style={{ width: 300, height: 230 }}
            resizeMode="contain"
            accessible
            accessibilityLabel="A guardian holding their baby and an open BabyBook protected by a lock shield"
        />
    );
}
