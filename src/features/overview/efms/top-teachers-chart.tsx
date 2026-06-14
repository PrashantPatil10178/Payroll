"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

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
	earnings: {
		label: "Earnings",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

type Teacher = { name: string; earnings: number; sessions: number };

export function TopTeachersChart({
	data,
	month,
}: {
	data: Teacher[];
	month: string;
}) {
	if (data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top Teachers</CardTitle>
					<CardDescription>{month}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="py-8 text-center text-muted-foreground text-sm">
						No sessions recorded this month.
					</p>
				</CardContent>
			</Card>
		);
	}

	const chartData = data.map((t) => ({ name: t.name.split(" ")[0], earnings: t.earnings }));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top Teachers by Earnings</CardTitle>
				<CardDescription>{month}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="max-h-[260px] w-full">
					<BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32 }}>
						<XAxis
							type="number"
							tickLine={false}
							axisLine={false}
							tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
						/>
						<YAxis
							type="category"
							dataKey="name"
							tickLine={false}
							axisLine={false}
							width={72}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									formatter={(value) => currency.format(Number(value))}
								/>
							}
						/>
						<Bar dataKey="earnings" fill="var(--color-earnings)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
