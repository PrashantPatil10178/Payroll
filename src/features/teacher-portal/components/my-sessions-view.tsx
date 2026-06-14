"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { MONTHS } from "@/features/payroll/types";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

function typeLabel(t: string) {
	return t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");
}

type Session = {
	id: string;
	title: string;
	sessionType: string;
	date: Date;
	durationMinutes: number;
	amount: number;
	remarks: string | null;
};

type Profile = { fullName: string; specialization: string | null };

export function MySessionsView({
	profile,
	sessions,
	month,
	year,
}: {
	profile: Profile;
	sessions: Session[];
	month: number;
	year: number;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const now = new Date();
	const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

	const setParam = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set(key, value);
		router.push(`${pathname}?${params.toString()}`);
	};

	const totals = sessions.reduce(
		(acc, s) => {
			acc.count += 1;
			acc.minutes += s.durationMinutes;
			acc.amount += s.amount;
			return acc;
		},
		{ count: 0, minutes: 0, amount: 0 },
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<Select onValueChange={(v) => setParam("month", v)} value={String(month)}>
					<SelectTrigger className="w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{MONTHS.map((m, i) => (
							<SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select onValueChange={(v) => setParam("year", v)} value={String(year)}>
					<SelectTrigger className="w-24">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			<div className="grid grid-cols-3 gap-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Sessions</CardDescription>
						<CardTitle className="text-2xl tabular-nums">{totals.count}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Hours</CardDescription>
						<CardTitle className="text-2xl tabular-nums">
							{Math.floor(totals.minutes / 60)}h {totals.minutes % 60}m
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Earnings</CardDescription>
						<CardTitle className="text-2xl tabular-nums">{currency.format(totals.amount)}</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{sessions.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">
						No sessions recorded for {MONTHS[month - 1]} {year}.
					</p>
				</div>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Title</TableHead>
								<TableHead>Type</TableHead>
								<TableHead className="text-right">Duration</TableHead>
								<TableHead className="text-right">Amount</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sessions.map((s) => (
								<TableRow key={s.id}>
									<TableCell className="tabular-nums text-sm">
										{new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
									</TableCell>
									<TableCell className="font-medium">{s.title}</TableCell>
									<TableCell>
										<Badge variant="outline">{typeLabel(s.sessionType)}</Badge>
									</TableCell>
									<TableCell className="text-right tabular-nums">{s.durationMinutes} min</TableCell>
									<TableCell className="text-right font-medium tabular-nums">
										{currency.format(s.amount)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
