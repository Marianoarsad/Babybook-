// Select each metric independently; a later partial record must not erase a reading.
export function latestProfileMeasurements(rows = []) {
    const sorted = rows.filter(row => {
        const date = String(row.date_recorded || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))
            && new Date(date).toISOString().slice(0, 10) === date;
    }).slice().sort((a, b) => String(b.date_recorded).localeCompare(String(a.date_recorded))
        || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
    return [
        ["weight", "Weight", "weight", "kg"],
        ["height", "Height", "height", "cm"],
        ["head", "Head", "head_circumference", "cm"],
    ].map(([key, label, field, unit]) => {
        const row = sorted.find(row => row[field] != null && String(row[field]).trim() !== ""
            && Number.isFinite(Number(row[field])) && Number(row[field]) > 0);
        return { key, label, unit, value: row ? row[field] : null,
            date: row ? String(row.date_recorded).slice(0, 10) : "" };
    });
}

export function commonMeasurementDate(measurements) {
    const dates = measurements.filter(m => m.value != null).map(m => m.date);
    return dates.length && dates.every(date => date === dates[0]) ? dates[0] : "";
}

export function ageText(dob) {
    if (!dob) return "";
    const b = new Date(`${String(dob).slice(0, 10)}T00:00:00`);
    if (isNaN(b.getTime())) return "";
    const now = new Date();
    let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) months -= 1;
    if (months < 0) months = 0;
    if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    const y = `${years} year${years === 1 ? "" : "s"}`;
    return rem ? `${y} ${rem} month${rem === 1 ? "" : "s"}` : y;
}

