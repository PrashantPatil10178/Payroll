"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import type { TeacherOption } from "@/features/sessions/types";
import { SESSION_TYPE_OPTIONS } from "@/features/sessions/types";
import { MONTHS } from "@/features/payroll/types";
import { downloadExcel } from "../lib/export";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

export function FinanceReportView({ teachers }: { teachers: TeacherOption[] }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const now = new Date();
	const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
	const year = Number(searchParams.get("year") ?? now.getFullYear());
	const teacherId = searchParams.get("teacherId") ?? undefined;
	const sessionType = searchParams.get("sessionType") ?? undefined;

	type SessionTypeVal = "LIVE_CLASS" | "RECORDING" | "YOUTUBE" | "DOUBT_SOLVING" | "WEBINAR";
	const { data, isFetching } = api.efms.financeReport.useQuery({
		month,
		year,
		teacherId: teacherId || undefined,
		sessionType: (sessionType as SessionTypeVal) ?? undefined,
	});

	const setParam = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "all") {
			params.delete(key);
		} else {
			params.set(key, value);
		}
		router.push(`${pathname}?${params.toString()}`);
	};

	const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

	const [exporting, setExporting] = useState(false);
	const exportPdf = api.efms.exportReportPdf.useMutation();

	const handleExcel = () => {
		if (!data) return;
		const rows = data.rows.map((r) => ({
			Teacher: r.teacherName,
			Code: r.teacherCode,
			Sessions: r.sessions,
			"Hours": `${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`,
			"Live (₹)": r.live,
			"Recording (₹)": r.recording,
			"YouTube (₹)": r.youtube,
			"Other (₹)": r.other,
			"Total (₹)": r.total,
		}));
		downloadExcel(rows, "Finance", `finance_report_${MONTHS[month - 1]}_${year}`);
		toast.success("Excel downloaded.");
	};

	const handlePdf = async () => {
		if (!data) return;
		setExporting(true);
		try {
			const columns = ["Teacher", "Sessions", "Hours", "Live", "Recording", "YouTube", "Other", "Total"];
			const body = data.rows.map((r) => [
				r.teacherName,
				String(r.sessions),
				`${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`,
				`Rs.${r.live.toLocaleString("en-IN")}`,
				`Rs.${r.recording.toLocaleString("en-IN")}`,
				`Rs.${r.youtube.toLocaleString("en-IN")}`,
				`Rs.${r.other.toLocaleString("en-IN")}`,
				`Rs.${r.total.toLocaleString("en-IN")}`,
			]);
			const title = `Finance Report - ${MONTHS[month - 1] ?? month} ${year}`;
			const result = await exportPdf.mutateAsync({ type: "finance", month, year, title, columns, body });
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
			{/* Filters */}
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

				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">Teacher</span>
					<Select onValueChange={(v) => setParam("teacherId", v)} value={teacherId ?? "all"}>
						<SelectTrigger className="w-48">
							<SelectValue placeholder="All teachers" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All teachers</SelectItem>
							{teachers.map((t) => (
								<SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">Session Type</span>
					<Select onValueChange={(v) => setParam("sessionType", v)} value={sessionType ?? "all"}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="All types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All types</SelectItem>
							{SESSION_TYPE_OPTIONS.map((o) => (
								<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{data && data.rows.length > 0 && (
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

			{/* Summary cards */}
			{data && (
				<div className="grid grid-cols-3 gap-3">
					<div className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-sm">Total Sessions</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums">{data.totals.grandSessions}</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-sm">Total Hours</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums">
							{Math.floor(data.totals.grandMinutes / 60)}h {data.totals.grandMinutes % 60}m
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-sm">Total Payout</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums">
							{currency.format(data.totals.grandTotal)}
						</p>
					</div>
				</div>
			)}

			{/* Table */}
			{isFetching ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">Loading…</p>
				</div>
			) : !data || data.rows.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">No sessions found for this period.</p>
				</div>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Teacher</TableHead>
								<TableHead className="text-right">Sessions</TableHead>
								<TableHead className="text-right">Hours</TableHead>
								<TableHead className="text-right">Live</TableHead>
								<TableHead className="text-right">Recording</TableHead>
								<TableHead className="text-right">YouTube</TableHead>
								<TableHead className="text-right">Other</TableHead>
								<TableHead className="text-right font-semibold">Total</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.rows.map((row) => (
								<TableRow key={row.teacherCode}>
									<TableCell className="font-medium">{row.teacherName}</TableCell>
									<TableCell className="text-right tabular-nums">{row.sessions}</TableCell>
									<TableCell className="text-right tabular-nums">
										{Math.floor(row.minutes / 60)}h {row.minutes % 60}m
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{row.live > 0 ? currency.format(row.live) : "—"}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{row.recording > 0 ? currency.format(row.recording) : "—"}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{row.youtube > 0 ? currency.format(row.youtube) : "—"}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{row.other > 0 ? currency.format(row.other) : "—"}
									</TableCell>
									<TableCell className="text-right font-semibold tabular-nums">
										{currency.format(row.total)}
									</TableCell>
								</TableRow>
							))}
							{/* Grand total row */}
							<TableRow className="border-t-2 font-semibold">
								<TableCell>Grand Total</TableCell>
								<TableCell className="text-right tabular-nums">{data.totals.grandSessions}</TableCell>
								<TableCell className="text-right tabular-nums">
									{Math.floor(data.totals.grandMinutes / 60)}h {data.totals.grandMinutes % 60}m
								</TableCell>
								<TableCell colSpan={4} />
								<TableCell className="text-right tabular-nums">
									{currency.format(data.totals.grandTotal)}
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
