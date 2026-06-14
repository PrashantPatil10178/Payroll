import { MonthlyTrendChart } from "@/features/overview/efms/monthly-trend-chart";
import { api } from "@/trpc/server";

export default async function AreaStats() {
	const data = await api.efms.monthlyTrend();
	return <MonthlyTrendChart data={data} />;
}
