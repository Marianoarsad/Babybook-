// shareStore.js
// Shared constants for the parent-controlled QR consultation-access feature.
// The actual share/access-log data lives on the backend (see
// back-end/src/routes/share.routes.js, consult.routes.js) and is reached
// through utils/api.js. This file only holds the record-type label map and
// QR-payload formatting used by the UI (ShareRecords.js, ProfessionalView.js).

export const RECORD_LABELS = {
  profile: "Child Profile & Birth Info",
  vaccinations: "Vaccination History",
  allergies: "Allergies & Hereditary Conditions",
  growth: "Growth Measurements",
  milestones: "Developmental Milestones",
  checkups: "Checkups & Appointments",
  nutrition: "Nutrition & Feeding",
  medicalHistory: "Medical History (Illnesses, Medications, Hospitalizations)",
};

// Keep in step with VISIT_REASON_MAX in back-end/src/utils/snapshot.js, which
// is the authority — the server trims to it regardless of what the client does.
export const VISIT_REASON_MAX = 500;

// The string actually encoded into the QR image.
export function qrPayloadForCode(code) {
  return "BABYBOOK+CONSULT:" + code;
}
