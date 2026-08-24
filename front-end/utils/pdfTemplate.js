// Builds the printable/exportable HTML for a child's records. Rendered by
// expo-print (front-end/utils/exportPdf.js), which does not fetch external
// stylesheets — everything here must be inline CSS.
//
// Print-safe palette: dark ink on white with a single accent color. The
// app's lighter pink theme tones don't reliably survive black-and-white
// printing at a health center, so this deliberately does not pull from
// theme.js.
import { feedRowSummary } from "./adapters";

// A reaction column that reads the structured severity first and only falls
// back to free text. Pre-migration rows carry a description with no severity;
// rows with neither are blank rather than reading as "no reaction".
function reactionText(f) {
    const sev = f.reaction_severity;
    if (sev === "none") return "No reaction";
    if (sev === "mild" || sev === "severe") {
        const label = sev === "severe" ? "Severe reaction" : "Mild reaction";
        return f.reaction ? `${label}: ${f.reaction}` : label;
    }
    return f.reaction ? `Reaction: ${f.reaction}` : "";
}

const INK = "#1B1F3B";
const MUTED = "#5B618A";
const ACCENT = "#B0356B"; // dark enough to read as a solid gray in B&W print
const BORDER = "#D8D5CE";

// Keys match RECORD_LABELS in utils/shareStore.js exactly, so a QR share's
// shared_record_keys can be passed in as the scope with no mapping table in
// between — a mapping table is how the printed copy and the on-screen copy
// would drift apart.
const CATEGORY_LABELS = {
    profile: "Child Profile & Birth Info",
    allergies: "Allergies & Hereditary Conditions",
    vaccinations: "Vaccinations",
    checkups: "Checkups & Appointments",
    growth: "Growth Measurements",
    milestones: "Developmental Milestones",
    nutrition: "Nutrition Summary",
    medicalHistory: "Medical History",
};

function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function calcAge(dob) {
    if (!dob) return "";
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return "";
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    if (months < 0) return "";
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${months} mo`;
    return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
}

function section(title, bodyHtml) {
    return `
    <div class="section">
        <div class="section-title">${esc(title)}</div>
        ${bodyHtml}
    </div>`;
}

function table(rows) {
    if (!rows.length) return `<div class="empty">No records.</div>`;
    return `<table class="tbl"><tbody>${rows.join("")}</tbody></table>`;
}

function row(cells) {
    return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

// profile: the app's child-profile shape (see utils/adapters.js childToProfile).
// records: { vaccinations, checkups, growth, milestones, nutrition, medicalHistory } — raw
//   backend rows (snake_case), each an array. Missing keys are treated as excluded.
export function buildRecordHtml(profile, records = {}, options = {}) {
    const scope = options.scope || new Set(Object.keys(CATEGORY_LABELS));
    const generatedAt = new Date().toLocaleString(undefined, {
        day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
    });

    const sections = [];

    if (scope.has("vaccinations") && records.vaccinations) {
        const byVisit = new Map();
        for (const v of records.vaccinations) {
            const key = v.visit_name || "Other";
            if (!byVisit.has(key)) byVisit.set(key, []);
            byVisit.get(key).push(v);
        }
        const sorted = [...byVisit.entries()].sort((a, b) => {
            const da = a[1][0]?.due_date || "9999";
            const db = b[1][0]?.due_date || "9999";
            return String(da).localeCompare(String(db));
        });
        const body = sorted
            .map(([visit, doses]) => {
                const doseRows = doses
                    .map((v) =>
                        row([
                            esc(v.vaccine_name),
                            v.status === "completed"
                                ? `<span class="ok">Given ${esc(fmtDate(v.date_given))}</span>`
                                : `<span class="pending">Due ${esc(fmtDate(v.due_date))}</span>`,
                        ])
                    )
                    .join("");
                return `<div class="subhead">${esc(visit)}</div><table class="tbl"><tbody>${doseRows}</tbody></table>`;
            })
            .join("");
        sections.push(section(CATEGORY_LABELS.vaccinations, body || `<div class="empty">No records.</div>`));
    }

    if (scope.has("checkups") && records.checkups) {
        const rows = records.checkups.map((c) =>
            row([
                esc(c.title || "Checkup"),
                esc([c.doctor_name, c.clinic].filter(Boolean).join(" · ") || "—"),
                esc(fmtDate(c.checkup_date)),
            ])
        );
        sections.push(section(CATEGORY_LABELS.checkups, table(rows)));
    }

    if (scope.has("growth") && records.growth) {
        const rows = records.growth.map((g) =>
            row([
                esc(fmtDate(g.date_recorded)),
                `${g.height ?? "—"} cm`,
                `${g.weight ?? "—"} kg`,
                g.head_circumference ? `HC ${g.head_circumference} cm` : "",
            ])
        );
        sections.push(section(CATEGORY_LABELS.growth, table(rows)));
    }

    if (scope.has("milestones") && records.milestones) {
        const rows = records.milestones.map((m) =>
            row([esc(m.title), m.is_completed ? "<span class=\"ok\">Reached</span>" : "Not yet", esc(fmtDate(m.date_recorded))])
        );
        sections.push(section(CATEGORY_LABELS.milestones, table(rows)));
    }

    if (scope.has("nutrition") && records.nutrition) {
        const rows = records.nutrition.map((f) =>
            row([
                esc(feedRowSummary(f)),
                esc(reactionText(f)),
                esc(fmtDate(f.entry_date)),
            ])
        );
        sections.push(section(CATEGORY_LABELS.nutrition, table(rows)));
    }

    if (scope.has("medicalHistory") && records.medicalHistory) {
        const rows = records.medicalHistory.map((h) =>
            row([esc(h.category), esc(h.title), esc(fmtDate(h.date_recorded))])
        );
        sections.push(section(CATEGORY_LABELS.medicalHistory, table(rows)));
    }

    // These used to print no matter what, OUTSIDE the scope checks — so a
    // parent who unticked "Allergies & Hereditary Conditions" when generating
    // a consultation code got a QR view that honoured it and a printout that
    // did not. Scope now governs the whole document, not just the sections.
    const showProfile = scope.has("profile");
    const showAllergies = scope.has("allergies");

    const allergyLine = (profile.allergies || []).length
        ? esc(profile.allergies.join(", "))
        : "None recorded";
    const hereditaryLine = (profile.hereditaryConditions || []).length
        ? esc(profile.hereditaryConditions.join(", "))
        : "None recorded";

    // The profile grid is built from whichever halves are in scope.
    const profileCells = [
        ...(showProfile
            ? [
                  `<div><span class="k">Sex:</span> ${esc(profile.sex || "—")}</div>`,
                  `<div><span class="k">Blood Type:</span> ${esc(profile.bloodType || "—")}</div>`,
                  `<div><span class="k">Hospital:</span> ${esc(profile.hospital || "—")}</div>`,
                  `<div><span class="k">Pediatrician:</span> ${esc(profile.pediatricianName || "—")}</div>`,
              ]
            : []),
        ...(showAllergies
            ? [
                  `<div><span class="k">Allergies:</span> ${allergyLine}</div>`,
                  `<div><span class="k">Hereditary Conditions:</span> ${hereditaryLine}</div>`,
              ]
            : []),
    ];

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${INK}; margin: 0; padding: 28px; }
    .header { border-bottom: 2px solid ${ACCENT}; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 12px; font-weight: 700; color: ${ACCENT}; letter-spacing: 1px; text-transform: uppercase; }
    .child-name { font-size: 24px; font-weight: 800; margin-top: 4px; }
    .meta { font-size: 12px; color: ${MUTED}; margin-top: 4px; }
    .profile-grid { display: flex; flex-wrap: wrap; gap: 6px 24px; margin-bottom: 18px; font-size: 12px; }
    .profile-grid div span.k { color: ${MUTED}; }
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section-title { font-size: 14px; font-weight: 800; color: ${ACCENT}; border-bottom: 1px solid ${BORDER}; padding-bottom: 4px; margin-bottom: 8px; }
    .subhead { font-size: 11px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 2px; }
    table.tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.tbl td { padding: 4px 6px; border-bottom: 1px solid ${BORDER}; vertical-align: top; }
    .empty { font-size: 12px; color: ${MUTED}; font-style: italic; }
    .ok { color: #1a7a4c; font-weight: 700; }
    .pending { color: #a15b00; font-weight: 700; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid ${BORDER}; font-size: 10px; color: ${MUTED}; }
</style>
</head>
<body>
    <!-- Name and date of birth print on EVERY copy, even when "profile" is
         out of scope. This is a deliberate exception to the scope rule: a
         loose sheet of paper with no name on it is a misfiling hazard in a way
         an on-screen view is not — the screen belongs to one consultation, the
         paper can end up in the wrong folder. Everything else about the child
         still obeys the parent's selection. -->
    <div class="header">
        <div class="brand">BabyBook+</div>
        <div class="child-name">${esc(profile.name)}</div>
        <div class="meta">
            Date of Birth: ${esc(fmtDate(profile.dateOfBirth))}${profile.dateOfBirth ? ` (${esc(calcAge(profile.dateOfBirth))})` : ""}
            &nbsp;·&nbsp; Generated ${esc(generatedAt)}
        </div>
    </div>

    ${profileCells.length ? `<div class="profile-grid">${profileCells.join("")}</div>` : ""}

    ${sections.join("")}

    <div class="footer">
        These records are parent-maintained via the BabyBook+ app and have not been independently
        clinically verified. Generated ${esc(generatedAt)}.
    </div>
</body>
</html>`;
}

export { CATEGORY_LABELS };
