import PageContainer from "@/components/layout/page-container";
import { FinanceReportView } from "@/features/reports/components/finance-report-view";
import type { TeacherOption } from "@/features/sessions/types";
import { api } from "@/trpc/server";

export const metadata = { title: "Reports: Finance" };

export default async function FinanceReportPage() {
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
			pageTitle="Finance Report"
			pageDescription="Monthly financial summary by teacher and session type."
		>
			<FinanceReportView teachers={opts} />
		</PageContainer>
	);
}
