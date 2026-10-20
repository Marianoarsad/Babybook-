import { buildFeedingCountChart } from "./feedingCountChart";
import { byMoment } from "./feedingStats";
import { shortDate, numericDate, todayLocal } from "./dates";

export const FOOD_CATEGORIES = ["fruits", "vegetables", "grains", "proteins", "dairy", "other"];
const CATEGORY_ALIASES = { fruit: "fruits", fruits: "fruits", vegetable: "vegetables", vegetables: "vegetables",
    grain: "grains", grains: "grains", protein: "proteins", proteins: "proteins", dairy: "dairy", other: "other" };
export const resolveFoodCategory = value => {
    const key = typeof value === "string" ? value.trim().toLowerCase() : "";
    return Object.hasOwn(CATEGORY_ALIASES, key) ? CATEGORY_ALIASES[key] : null;
};
export const foodCategoryLabel = value => {
    const category = resolveFoodCategory(value);
    return category ? category[0].toUpperCase() + category.slice(1) : "Category not recorded";
};
export const solidFoodCategory = entry => resolveFoodCategory(entry.foodCategory) || "other";
export const foodReactionLabel = entry => entry.reactionSeverity === "severe" ? "Severe"
    : entry.reactionSeverity === "mild" ? "Mild" : "Reaction recorded";
export const sortSolidFoods = entries => entries.slice().sort((a, b) => byMoment(b, a) || Number(b.id) - Number(a.id));
export function searchSolidFoods(entries, query) {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter(entry => [entry.foodIntroduced, foodCategoryLabel(entry.foodCategory), entry.date,
        shortDate(entry.date), numericDate(entry.date), entry.reactionSeverity, entry.reaction, entry.notes]
        .filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
}
export function buildSolidFoodChart(entries, range = "7", today = todayLocal()) {
    const chart = buildFeedingCountChart(entries.filter(entry => entry.entryType === "solid"), FOOD_CATEGORIES, solidFoodCategory, range, today);
    const interval = range === "all" ? "All Time" : range === "3m" ? "Last 3 Months" : `Last ${range === "30" ? 30 : 7} Days`;
    const displayPercentages = Object.fromEntries(FOOD_CATEGORIES.map(c => [c, chart.total ? Math.floor(chart.percentages[c]) : null]));
    if (chart.total) {
        const remainder = 100 - Object.values(displayPercentages).reduce((sum, value) => sum + value, 0);
        const ranked = FOOD_CATEGORIES.slice().sort((a, b) => (chart.percentages[b] - displayPercentages[b]) - (chart.percentages[a] - displayPercentages[a]));
        for (const category of ranked.slice(0, remainder)) displayPercentages[category]++;
    }
    return { ...chart, displayPercentages, title: `Solid Food Consumption (${interval})`,
        subtitle: chart.granularity === "day" ? "Number of food entries per day, grouped by food category."
            : `${chart.granularity === "week" ? "Weekly" : "Monthly"} food entry totals, grouped by food category.` };
}
