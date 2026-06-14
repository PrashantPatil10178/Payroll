"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api } from "@/trpc/react";
import { MONTHS } from "@/features/payroll/types";
import { SESSION_TYPE_OPTIONS } from "@/features/sessions/types";
import { downloadExcel } from "../lib/export";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

function typeLabel(t: string) {
	return t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");
}

const SESSION_TYPES = SESSION_TYPE_OPTIONS.map((o) => o.value);

export function ActivityReportView() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const now = new Date();
	const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
	const year = Number(searchParams.get("year") ?? now.getFullYear());

	const { data, isFetching } = api.efms.activityReport.useQuery({ month, year });

	const setParam = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set(key, value);
		router.push(`${pathname}?${params.toString()}`);
	};

	const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

	const [exporting, setExporting] = useState(false);
	const exportPdf = api.efms.exportReportPdf.useMutation();

	const handleExcel = () => {
		if (!data) return;
		const rows = data.map((r) => ({
			Code: r.teacherCode,
			Teacher: r.fullName,
			Sessions: r.sessions,
			"Hours": `${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`,
			...Object.fromEntries(
				SESSION_TYPES.map((t) => [typeLabel(t), r.byType[t] ?? 0])
			),
			"Total (₹)": r.amount,
		}));
		downloadExcel(rows, "Activity", `activity_${MONTHS[month - 1]}_${year}`);
		toast.success("Excel downloaded.");
	};

	const handlePdf = async () => {
		if (!data) return;
		setExporting(true);
		try {
			const columns = ["Code", "Teacher", "Sessions", "Hours", "Total Payout"];
			const body = data.map((r) => [
				r.teacherCode,
				r.fullName,
				String(r.sessions),
				`${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`,
				`Rs.${r.amount.toLocaleString("en-IN")}`,
			]);
			const title = `Activity Report - ${MONTHS[month - 1] ?? month} ${year}`;
			const result = await exportPdf.mutateAsync({ type: "activity", month, year, title, columns, body });
			window.open(result.url, "_blank");
			toast.success("PDF saved to cloud and opened.");
		} catch {
			toast.error("PDF export failed.");
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">Month</span>
					<div className="flex gap-1">
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
				</div>

				{data && data.length > 0 && (
					<div className="ml-auto flex gap-2">
						<Button onClick={handleExcel} size="sm" variant="outline">
							<FileSpreadsheet className="size-4" />
							Excel
						</Button>
						<Button disabled={exporting} onClick={handlePdf} size="sm" variant="outline">
							<FileText className="size-4" />
							PDF
						</Button>
					</div>
				)}
			</div>

			{isFetching ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">Loading…</p>
				</div>
			) : !data || data.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">
						No active teachers with sessions in {MONTHS[month - 1]} {year}.
					</p>
				</div>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Code</TableHead>
								<TableHead>Teacher</TableHead>
								<TableHead className="text-right">Sessions</TableHead>
								<TableHead className="text-right">Hours</TableHead>
								{SESSION_TYPES.map((t) => (
									<TableHead key={t} className="text-right text-xs">
										{typeLabel(t)}
									</TableHead>
								))}
								<TableHead className="text-right">Total</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((row) => (
								<TableRow key={row.teacherId}>
									<TableCell className="font-mono text-xs">{row.teacherCode}</TableCell>
									<TableCell className="font-medium">{row.fullName}</TableCell>
									<TableCell className="text-right tabular-nums">{row.sessions}</TableCell>
									<TableCell className="text-right tabular-nums">
										{Math.floor(row.minutes / 60)}h {row.minutes % 60}m
									</TableCell>
									{SESSION_TYPES.map((t) => (
										<TableCell key={t} className="text-right tabular-nums text-muted-foreground">
											{row.byType[t] ? (
												<Badge variant="secondary" className="tabular-nums">
													{row.byType[t]}
												</Badge>
											) : (
												"—"
											)}
										</TableCell>
									))}
									<TableCell className="text-right font-medium tabular-nums">
										{row.amount > 0 ? currency.format(row.amount) : "—"}
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
