const pad = (value) => String(value).padStart(2, "0");

export function timeParts(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
    const hour24 = match && Number(match[1]) < 24 ? Number(match[1]) : 9;
    const minute = match && Number(match[2]) < 60 ? Number(match[2]) : 0;
    return {
        period: hour24 >= 12 ? "PM" : "AM",
        hour: hour24 % 12 || 12,
        minute,
    };
}

export function timeValue({ period, hour, minute }) {
    const hour24 = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
    return `${pad(hour24)}:${pad(Number(minute))}`;
}

export function pickerDateParts(value, fallback) {
    const source = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : fallback;
    const [year, month, day] = String(source).split("-").map(Number);
    return { year, month, day };
}

export function pickerDateValue(parts, minimumDate, maximumDate) {
    const year = Math.trunc(Number(parts.year));
    const month = Math.max(1, Math.min(12, Math.trunc(Number(parts.month))));
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.max(1, Math.min(lastDay, Math.trunc(Number(parts.day))));
    const candidate = `${year}-${pad(month)}-${pad(day)}`;
    if (minimumDate && candidate < minimumDate) return minimumDate;
    if (maximumDate && candidate > maximumDate) return maximumDate;
    return candidate;
}

export function pickerYears(value, minimumDate, maximumDate, currentYear = new Date().getFullYear()) {
    const selectedYear = Number(String(value || "").slice(0, 4)) || currentYear;
    const first = minimumDate
        ? Number(minimumDate.slice(0, 4))
        : Math.min(selectedYear, currentYear - 120);
    const last = maximumDate
        ? Number(maximumDate.slice(0, 4))
        : Math.max(selectedYear, currentYear + 20);
    return Array.from({ length: Math.max(1, last - first + 1) }, (_, index) => first + index);
}

export function selectableMonths(year, now = new Date()) {
    if (year > now.getFullYear()) return Array.from({ length: 12 }, (_, index) => index);
    if (year < now.getFullYear()) return [];
    return Array.from({ length: 12 - now.getMonth() }, (_, index) => now.getMonth() + index);
}
