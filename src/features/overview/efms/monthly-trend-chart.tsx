"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
	sessions: {
		label: "Sessions",
		color: "var(--chart-2)",
	},
	payout: {
		label: "Payout (₹)",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

type TrendPoint = { label: string; sessions: number; payout: number };

export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Monthly Trend</CardTitle>
				<CardDescription>Sessions & payout — last 6 months</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart data={data} accessibilityLayer>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
						/>
						<YAxis
							yAxisId="sessions"
							orientation="left"
							tickLine={false}
							axisLine={false}
							width={32}
						/>
						<YAxis
							yAxisId="payout"
							orientation="right"
							tickLine={false}
							axisLine={false}
							width={52}
							tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" />}
						/>
						<defs>
							<linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-sessions)"
									stopOpacity={0.4}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-sessions)"
									stopOpacity={0}
								/>
							</linearGradient>
							<linearGradient id="fillPayout" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-payout)"
									stopOpacity={0.4}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-payout)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<Area
							yAxisId="sessions"
							dataKey="sessions"
							type="natural"
							fill="url(#fillSessions)"
							stroke="var(--color-sessions)"
							strokeWidth={1.5}
						/>
						<Area
							yAxisId="payout"
							dataKey="payout"
							type="natural"
							fill="url(#fillPayout)"
							stroke="var(--color-payout)"
							strokeWidth={1.5}
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
