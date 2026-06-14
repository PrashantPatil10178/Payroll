import Link from "next/link";

import PageContainer from "@/components/layout/page-container";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Dashboard: Reports" };

const REPORTS = [
	{
		title: "Teacher Report",
		description:
			"View all sessions for a specific teacher across a date range. Export to Excel or PDF.",
		href: "/dashboard/reports/teacher",
	},
	{
		title: "Finance Report",
		description:
			"Monthly financial summary — per-teacher breakdown by session type with grand totals. Export to Excel or PDF.",
		href: "/dashboard/reports/finance",
	},
	{
		title: "Activity Report",
		description:
			"Monthly activity snapshot for all active teachers — sessions, hours, and payout breakdown. Export to Excel or PDF.",
		href: "/dashboard/reports/activity",
	},
];

export default function ReportsPage() {
	return (
		<PageContainer
			pageTitle="Reports"
			pageDescription="Generate and export EFMS reports."
		>
			<div className="grid gap-4 md:grid-cols-3">
				{REPORTS.map((r) => (
					<Link key={r.href} href={r.href}>
						<Card className="h-full transition-shadow hover:shadow-md">
							<CardHeader>
								<CardTitle>{r.title}</CardTitle>
								<CardDescription>{r.description}</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</PageContainer>
	);
}
