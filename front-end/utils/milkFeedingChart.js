import { feedingMixCategory } from "./feedingStats";
import { todayLocal } from "./dates";
import { MILK_TYPES } from "./milkTypeHistory";
import { buildFeedingCountChart } from "./feedingCountChart";
export { feedingCountAxis as milkFeedAxis } from "./feedingCountChart";

export function milkFeedType(feed) {
    return { breastmilk: "Breastmilk", formula: "Formula", mixed: "Mixed" }[feedingMixCategory(feed)] || null;
}
export function buildMilkFeedingChart(feeds, range = "7", today = todayLocal()) {
    const chart = buildFeedingCountChart(feeds.filter(feed => (feed.entryType || "milk") === "milk"), MILK_TYPES, milkFeedType, range, today);
    return { ...chart,
        title: `Milk Feedings (${range === "all" ? "All Time" : range === "3m" ? "Last 3 Months" : `Last ${range === "30" ? 30 : 7} Days`})`,
        subtitle: chart.granularity === "day" ? "Number of recorded feedings per day, grouped by milk type." : `${chart.granularity === "week" ? "Weekly" : "Monthly"} feeding totals, grouped by milk type.` };
}
