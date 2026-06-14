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
import type { TeacherOption } from "@/features/sessions/types";
import { downloadExcel } from "../lib/export";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

function typeLabel(t: string) {
	return t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");
}

const MONTHS = [
	"January","February","March","April","May","June",
	"July","August","September","October","November","December",
];

export function TeacherReportView({ teachers }: { teachers: TeacherOption[] }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const now = new Date();
	const teacherId = searchParams.get("teacherId") ?? "";
	const startMonth = Number(searchParams.get("startMonth") ?? now.getMonth() + 1);
	const startYear = Number(searchParams.get("startYear") ?? now.getFullYear());
	const endMonth = Number(searchParams.get("endMonth") ?? now.getMonth() + 1);
	const endYear = Number(searchParams.get("endYear") ?? now.getFullYear());

	const startDate = new Date(startYear, startMonth - 1, 1);
	const endDate = new Date(endYear, endMonth, 0); // last day of end month

	const { data, isFetching } = api.efms.teacherReport.useQuery(
		{ teacherId, startDate, endDate },
		{ enabled: !!teacherId },
	);

	const setParam = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set(key, value);
		router.push(`${pathname}?${params.toString()}`);
	};

	const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

	const [exporting, setExporting] = useState(false);
	const exportPdf = api.efms.exportReportPdf.useMutation();

	const handleExcel = () => {
		if (!data) return;
		const rows = data.sessions.map((s) => ({
			Date: new Date(s.date).toLocaleDateString("en-IN"),
			Title: s.title,
			Type: typeLabel(s.sessionType),
			"Duration (min)": s.durationMinutes,
			"Amount (₹)": s.amount,
			Remarks: s.remarks ?? "",
		}));
		downloadExcel(rows, "Sessions", `${data.teacher.fullName}_sessions`);
		toast.success("Excel downloaded.");
	};

	const handlePdf = async () => {
		if (!data) return;
		setExporting(true);
		try {
			const columns = ["Date", "Title", "Type", "Duration", "Amount", "Remarks"];
			const body = data.sessions.map((s) => [
				new Date(s.date).toLocaleDateString("en-IN"),
				s.title,
				typeLabel(s.sessionType),
				`${s.durationMinutes} min`,
				`Rs.${s.amount.toLocaleString("en-IN")}`,
				s.remarks ?? "",
			]);
			const title = `Teacher Report - ${data.teacher.fullName}`;
			const result = await exportPdf.mutateAsync({ type: "teacher", teacherId, title, columns, body });
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
					<span className="text-muted-foreground text-xs">Teacher</span>
					<Select onValueChange={(v) => setParam("teacherId", v)} value={teacherId}>
						<SelectTrigger className="w-52">
							<SelectValue placeholder="Select teacher…" />
						</SelectTrigger>
						<SelectContent>
							{teachers.map((t) => (
								<SelectItem key={t.id} value={t.id}>
									{t.fullName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">From</span>
					<div className="flex gap-1">
						<Select onValueChange={(v) => setParam("startMonth", v)} value={String(startMonth)}>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MONTHS.map((m, i) => (
									<SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select onValueChange={(v) => setParam("startYear", v)} value={String(startYear)}>
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
					<span className="text-muted-foreground text-xs">To</span>
					<div className="flex gap-1">
						<Select onValueChange={(v) => setParam("endMonth", v)} value={String(endMonth)}>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MONTHS.map((m, i) => (
									<SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select onValueChange={(v) => setParam("endYear", v)} value={String(endYear)}>
							<SelectTrigger className="w-24">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
				</div>

				{data && (
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

			{/* Summary */}
			{data && (
				<div className="grid grid-cols-3 gap-3">
					<div className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-sm">Sessions</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums">{data.totals.sessions}</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-sm">Hours</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums">
							{Math.floor(data.totals.minutes / 60)}h {data.totals.minutes % 60}m
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-sm">Total Payout</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums">
							{currency.format(data.totals.amount)}
						</p>
					</div>
				</div>
			)}

			{/* Table */}
			{!teacherId ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">Select a teacher to view their report.</p>
				</div>
			) : isFetching ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">Loading…</p>
				</div>
			) : !data || data.sessions.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">No sessions found for this period.</p>
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
								<TableHead>Remarks</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.sessions.map((s) => (
								<TableRow key={s.id}>
									<TableCell className="tabular-nums">
										{new Date(s.date).toLocaleDateString("en-IN")}
									</TableCell>
									<TableCell className="font-medium">{s.title}</TableCell>
									<TableCell>
										<Badge variant="outline">{typeLabel(s.sessionType)}</Badge>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{s.durationMinutes} min
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{currency.format(s.amount)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{s.remarks ?? "—"}
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
