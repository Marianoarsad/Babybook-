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

export function selectableMonths(year, now = new Date()) {
    if (year > now.getFullYear()) return Array.from({ length: 12 }, (_, index) => index);
    if (year < now.getFullYear()) return [];
    return Array.from({ length: 12 - now.getMonth() }, (_, index) => now.getMonth() + index);
}
