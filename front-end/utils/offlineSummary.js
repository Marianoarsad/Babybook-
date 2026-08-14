// A per-child offline "consultation summary" — the shortcut named in the
// app's internal critical evaluation (Section 3.1) for closing the "no
// offline mode" gap without a full stale-while-revalidate rebuild across
// every screen. Cached from data the Dashboard already fetches on load (no
// extra request); readable with zero network from OfflineSummaryView the
// moment a parent needs it — e.g. an unreachable barangay health centre.
//
// Same rough shape as the backend's buildSnapshot() (utils/snapshot.js), but
// computed client-side from whatever the app last successfully loaded.
import { storage } from "./storageAdapter";

const KEY_PREFIX = "bb_offline_summary:";
const keyFor = (childId) => `${KEY_PREFIX}${childId}`;

// Builds and persists the summary. Never throws — a cache-write failure
// (storage full, private browsing, etc.) shouldn't break the dashboard load
// that triggered it.
export async function cacheSummary(profile, { vaccinations, checkups, medicalHistory }) {
    const summary = {
        cachedAt: new Date().toISOString(),
        profile: {
            name: profile.name,
            dateOfBirth: profile.dateOfBirth,
            sex: profile.sex,
            bloodType: profile.bloodType,
            allergies: profile.allergies || [],
            hereditaryConditions: profile.hereditaryConditions || [],
            pediatricianName: profile.pediatricianName,
            emergencyContact: profile.emergencyContact,
        },
        vaccinations: (vaccinations || [])
            .slice()
            .sort((a, b) => String(b.due_date || b.date_given || "").localeCompare(String(a.due_date || a.date_given || "")))
            .map((v) => ({
                vaccine_name: v.vaccine_name,
                status: v.status,
                due_date: v.due_date,
                date_given: v.date_given,
            })),
        medications: (medicalHistory || [])
            .filter((m) => m.category === "Medication" && !m.resolved)
            .map((m) => ({ title: m.title, description: m.description, notes: m.notes })),
        recentCheckups: (checkups || [])
            .filter((c) => c.status === "completed")
            .sort((a, b) => String(b.checkup_date || "").localeCompare(String(a.checkup_date || "")))
            .slice(0, 5)
            .map((c) => ({ title: c.title, checkup_date: c.checkup_date, doctor_name: c.doctor_name })),
    };
    try {
        await storage.setItem(keyFor(profile.id), JSON.stringify(summary));
    } catch (e) {
        // best-effort
    }
    return summary;
}

export async function getSummary(childId) {
    try {
        const raw = await storage.getItem(keyFor(childId));
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}
