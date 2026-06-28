import PageContainer from "@/components/layout/page-container";
import { TeacherReportView } from "@/features/reports/components/teacher-report-view";
import type { TeacherOption } from "@/features/sessions/types";
import { api } from "@/trpc/server";

export const metadata = { title: "Reports: Teacher" };

export default async function TeacherReportPage() {
	const teachers = await api.efms.teacherOptions();
	const opts: TeacherOption[] = teachers.map((t) => ({
		id: t.id,
		teacherCode: t.teacherCode,
		fullName: t.fullName,
		memberType: t.memberType as "TEACHER" | "FREELANCER",
		rates: null,
	}));

	return (
		<PageContainer
			pageTitle="Teacher Report"
			pageDescription="All sessions for a teacher within a date range."
		>
			<TeacherReportView teachers={opts} />
		</PageContainer>
	);
}
