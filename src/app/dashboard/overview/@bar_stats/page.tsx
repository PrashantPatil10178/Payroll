import { TopTeachersChart } from "@/features/overview/efms/top-teachers-chart";
import { api } from "@/trpc/server";

export default async function BarStats() {
	const data = await api.efms.overview();
	const now = new Date();
	const month = now.toLocaleString("en-US", { month: "long", year: "numeric" });
	return <TopTeachersChart data={data.topTeachers} month={month} />;
}
