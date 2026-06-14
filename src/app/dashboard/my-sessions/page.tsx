import PageContainer from "@/components/layout/page-container";
import { MySessionsView } from "@/features/teacher-portal/components/my-sessions-view";
import { api } from "@/trpc/server";

export const metadata = { title: "My Sessions" };

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export default async function MySessionsPage({ searchParams }: Props) {
	const sp = await searchParams;
	const now = new Date();
	const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
	const year = sp.year ? Number(sp.year) : now.getFullYear();

	const [profile, sessions] = await Promise.all([
		api.efms.myTeacherProfile(),
		api.efms.mySessions({ month, year }),
	]);

	return (
		<PageContainer
			pageTitle="My Sessions"
			pageDescription="Your recorded sessions and earnings."
		>
			<MySessionsView profile={profile} sessions={sessions} month={month} year={year} />
		</PageContainer>
	);
}
