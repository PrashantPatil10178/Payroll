import PageContainer from "@/components/layout/page-container";
import { ActivityReportView } from "@/features/reports/components/activity-report-view";

export const metadata = { title: "Reports: Activity" };

export default function ActivityReportPage() {
	return (
		<PageContainer
			pageTitle="Activity Report"
			pageDescription="Monthly session activity snapshot for all active teachers."
		>
			<ActivityReportView />
		</PageContainer>
	);
}
