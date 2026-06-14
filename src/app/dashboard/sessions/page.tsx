import PageContainer from "@/components/layout/page-container";
import { SessionsView } from "@/features/sessions/components/sessions-view";
import type { SessionRow, TeacherOption } from "@/features/sessions/types";
import { api } from "@/trpc/server";
import { SessionType } from "../../../../generated/prisma";

export const metadata = {
	title: "Dashboard: Sessions",
};

type PageProps = {
	searchParams: Promise<{
		month?: string;
		year?: string;
		teacherId?: string;
		sessionType?: string;
	}>;
};

export default async function SessionsPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const now = new Date();

	const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
	const year = sp.year ? Number(sp.year) : now.getFullYear();
	const teacherId = sp.teacherId || undefined;
	const sessionType =
		sp.sessionType &&
		Object.values(SessionType).includes(sp.sessionType as SessionType)
			? (sp.sessionType as SessionType)
			: undefined;

	const [sessions, teachers] = await Promise.all([
		api.efms.listSessions({ month, year, teacherId, sessionType }),
		api.efms.teacherOptions(),
	]);

	const rows: SessionRow[] = sessions.map((session) => ({
		id: session.id,
		title: session.title,
		teacherId: session.teacherId,
		teacherName: session.teacher.fullName,
		teacherCode: session.teacher.teacherCode,
		sessionType: session.sessionType,
		status: session.status,
		date: session.date.toISOString(),
		startTime: session.startTime.toISOString(),
		endTime: session.endTime.toISOString(),
		durationMinutes: session.durationMinutes,
		amount: Number(session.amount),
		remarks: session.remarks,
		attachments: session.attachments ?? [],
	}));

	const teacherOptions: TeacherOption[] = teachers.map((teacher) => ({
		id: teacher.id,
		teacherCode: teacher.teacherCode,
		fullName: teacher.fullName,
	}));

	return (
		<PageContainer
			pageTitle="Sessions"
			pageDescription="Record faculty sessions — duration and payout are calculated automatically."
		>
			<SessionsView
				filters={{ month, year, teacherId: teacherId ?? "", sessionType: sessionType ?? "" }}
				sessions={rows}
				teacherOptions={teacherOptions}
			/>
		</PageContainer>
	);
}
