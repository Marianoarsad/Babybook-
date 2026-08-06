// Client-side PDF export (Approach A from the Tier 2 plan): renders an HTML
// string via expo-print, no new backend endpoint and no server-side file
// storage. Guarded the same way utils/notifications.js guards
// expo-notifications, so a missing/unavailable module degrades gracefully
// instead of breaking the web build.
import { Platform } from "react-native";
import { api } from "./api";
import { buildRecordHtml } from "./pdfTemplate";

let Print = null;
try {
    // eslint-disable-next-line global-require
    Print = require("expo-print");
} catch (e) {
    Print = null;
}
let Sharing = null;
try {
    // eslint-disable-next-line global-require
    Sharing = require("expo-sharing");
} catch (e) {
    Sharing = null;
}

export function pdfExportAvailable() {
    return !!Print;
}

// Fetches every record type for the child and builds the HTML export. Split
// out from exportChildRecordsPdf so a scope-picker UI can call it directly
// if it ever needs the raw html (e.g. a preview).
export async function buildChildRecordsHtml(profile, scope) {
    const [vaccinations, checkups, growth, milestones, nutrition, medHistory] = await Promise.all([
        api.listRecords(profile.id, "vaccinations").catch(() => []),
        api.listRecords(profile.id, "checkups").catch(() => []),
        api.listRecords(profile.id, "growth").catch(() => []),
        api.listRecords(profile.id, "milestones").catch(() => []),
        api.listRecords(profile.id, "nutrition").catch(() => []),
        api.listRecords(profile.id, "medical-history").catch(() => []),
    ]);
    return buildRecordHtml(
        profile,
        { vaccinations, checkups, growth, milestones, nutrition, medicalHistory: medHistory },
        { scope }
    );
}

// Generates the PDF and hands it off: native shares the file, web opens the
// browser print dialog ("Save as PDF" is available from there).
export async function exportChildRecordsPdf(profile, { scope } = {}) {
    if (!Print) throw new Error("PDF export isn't available on this build.");
    const html = await buildChildRecordsHtml(profile, scope);

    if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${profile.name}'s BabyBook+ records` });
    }
}
