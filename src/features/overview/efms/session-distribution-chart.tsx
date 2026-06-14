"use client";

import { LabelList, Pie, PieChart } from "recharts";

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

const COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

function typeLabel(t: string) {
	return t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");
}

export function SessionDistributionChart({
	distribution,
	month,
}: {
	distribution: Record<string, number>;
	month: string;
}) {
	const entries = Object.entries(distribution);

	if (entries.length === 0) {
		return (
			<Card className="flex h-full flex-col">
				<CardHeader className="items-center pb-0">
					<CardTitle>Session Types</CardTitle>
					<CardDescription>{month}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-1 items-center justify-center">
					<p className="text-center text-muted-foreground text-sm">
						No sessions recorded this month.
					</p>
				</CardContent>
			</Card>
		);
	}

	const chartConfig: ChartConfig = { count: { label: "Sessions" } };
	const chartData = entries.map(([type, count], i) => ({
		type: typeLabel(type),
		count,
		fill: COLORS[i % COLORS.length] ?? "var(--chart-1)",
	}));
	for (const [type] of entries) {
		chartConfig[typeLabel(type)] = { label: typeLabel(type) };
	}

	return (
		<Card className="flex h-full flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>Session Type Distribution</CardTitle>
				<CardDescription>{month}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center pb-0">
				<ChartContainer
					config={chartConfig}
					className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[300px] min-h-[250px]"
				>
					<PieChart>
						<ChartTooltip
							content={<ChartTooltipContent nameKey="count" hideLabel />}
						/>
						<Pie
							data={chartData}
							dataKey="count"
							nameKey="type"
							innerRadius={30}
							cornerRadius={8}
							paddingAngle={4}
						>
							<LabelList
								dataKey="type"
								stroke="none"
								fontSize={11}
								fontWeight={500}
								fill="currentColor"
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
