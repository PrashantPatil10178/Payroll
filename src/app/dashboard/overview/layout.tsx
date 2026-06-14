import React from "react";

import { Icons } from "@/components/icons";
import PageContainer from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/server";

export const metadata = { title: "Dashboard: Overview" };

export default async function OverViewLayout({
	sales,
	pie_stats,
	bar_stats,
	area_stats,
}: {
	sales: React.ReactNode;
	pie_stats: React.ReactNode;
	bar_stats: React.ReactNode;
	area_stats: React.ReactNode;
}) {
	const data = await api.efms.overview();
	const { stats, organization } = data;

	const now = new Date();
	const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

	return (
		<PageContainer pageTitle={`Welcome back to ${organization.name}`}>
			<div className="flex flex-1 flex-col space-y-4">
				<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Active Teachers</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								{stats.totalTeachers}
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<Icons.employee className="size-3" />
									Teachers
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Total active faculty
							</div>
							<div className="text-muted-foreground">
								Across your organization
							</div>
						</CardFooter>
					</Card>

					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Classes This Month</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								{stats.totalClasses}
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<Icons.calendar className="size-3" />
									{monthLabel}
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Total sessions recorded
							</div>
							<div className="text-muted-foreground">Live, recording & more</div>
						</CardFooter>
					</Card>

					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Teaching Hours</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								{stats.totalHours}h
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<Icons.trendingUp className="size-3" />
									This month
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Total hours taught
							</div>
							<div className="text-muted-foreground">{monthLabel}</div>
						</CardFooter>
					</Card>

					<Card className="@container/card">
						<CardHeader>
							<CardDescription>Total Payout</CardDescription>
							<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
								₹{stats.totalPayout.toLocaleString("en-IN")}
							</CardTitle>
							<CardAction>
								<Badge variant="outline">
									<Icons.billing className="size-3" />
									{monthLabel}
								</Badge>
							</CardAction>
						</CardHeader>
						<CardFooter className="flex-col items-start gap-1.5 text-sm">
							<div className="line-clamp-1 flex gap-2 font-medium">
								Cumulative session payout
							</div>
							<div className="text-muted-foreground">
								Based on individual teacher rates
							</div>
						</CardFooter>
					</Card>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
					<div className="col-span-4">{bar_stats}</div>
					<div className="col-span-4 md:col-span-3">{sales}</div>
					<div className="col-span-4">{area_stats}</div>
					<div className="col-span-4 min-h-0 md:col-span-3">{pie_stats}</div>
				</div>
			</div>
		</PageContainer>
	);
}
