import { RecentSessions } from "@/features/overview/efms/recent-sessions";
import { api } from "@/trpc/server";

export default async function Sales() {
	const data = await api.efms.overview();
	const now = new Date();
	const month = now.toLocaleString("en-US", { month: "long", year: "numeric" });
	return <RecentSessions sessions={data.recentSessions} month={month} />;
}
