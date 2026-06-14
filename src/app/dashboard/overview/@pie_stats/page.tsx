import { SessionDistributionChart } from "@/features/overview/efms/session-distribution-chart";
import { api } from "@/trpc/server";

export default async function PieStats() {
	const data = await api.efms.overview();
	const now = new Date();
	const month = now.toLocaleString("en-US", { month: "long", year: "numeric" });
	return <SessionDistributionChart distribution={data.distribution} month={month} />;
}
