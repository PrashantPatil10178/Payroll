"use client";

import { Check, CheckCheck, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { SessionFormSheet } from "./session-form-sheet";
import {
	SESSION_TYPE_OPTIONS,
	type SessionRow,
	type TeacherOption,
	sessionTypeLabel,
} from "../types";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const ALL = "all";

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}
function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
	});
}
function formatDuration(minutes: number) {
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function SessionsView({
	filters,
	sessions,
	teacherOptions,
}: {
	filters: { month: number; year: number; teacherId: string; sessionType: string };
	sessions: SessionRow[];
	teacherOptions: TeacherOption[];
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<SessionRow | null>(null);

	const deleteSession = api.efms.deleteSession.useMutation({
		onSuccess: () => {
			toast.success("Session deleted.");
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const setSessionStatus = api.efms.setSessionStatus.useMutation({
		onSuccess: () => {
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const bulkApprove = api.efms.bulkApproveSessions.useMutation({
		onSuccess: (res) => {
			toast.success(`Approved ${res.approved} session${res.approved === 1 ? "" : "s"}.`);
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const pendingCount = sessions.filter((s) => s.status === "DRAFT").length;
	const actionBusy = setSessionStatus.isPending || bulkApprove.isPending;

	const setFilter = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value === ALL || value === "") {
			params.delete(key);
		} else {
			params.set(key, value);
		}
		router.push(`${pathname}?${params.toString()}`);
	};

	const years = Array.from({ length: 4 }, (_, i) => filters.year - 2 + i);

	const totals = sessions.reduce(
		(acc, s) => {
			acc.minutes += s.durationMinutes;
			acc.amount += s.amount;
			if (s.status === "APPROVED") acc.approvedAmount += s.amount;
			return acc;
		},
		{ minutes: 0, amount: 0, approvedAmount: 0 },
	);

	const openCreate = () => {
		setEditing(null);
		setOpen(true);
	};
	const openEdit = (session: SessionRow) => {
		setEditing(session);
		setOpen(true);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end justify-between gap-3">
				<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center w-full sm:w-auto">
					<Select
						onValueChange={(v) => setFilter("month", v)}
						value={String(filters.month)}
					>
						<SelectTrigger className="w-full sm:w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{MONTHS.map((label, index) => (
								<SelectItem key={label} value={String(index + 1)}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) => setFilter("year", v)}
						value={String(filters.year)}
					>
						<SelectTrigger className="w-full sm:w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{years.map((year) => (
								<SelectItem key={year} value={String(year)}>
									{year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) => setFilter("teacherId", v)}
						value={filters.teacherId || ALL}
					>
						<SelectTrigger className="w-full sm:w-44">
							<SelectValue placeholder="All teachers" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>All teachers</SelectItem>
							{teacherOptions.map((teacher) => (
								<SelectItem key={teacher.id} value={teacher.id}>
									{teacher.fullName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) => setFilter("sessionType", v)}
						value={filters.sessionType || ALL}
					>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="All types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>All types</SelectItem>
							{SESSION_TYPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto">
					{pendingCount > 0 && (
						<Button
							disabled={actionBusy}
							isLoading={bulkApprove.isPending}
							onClick={() =>
								bulkApprove.mutate({
									month: filters.month,
									year: filters.year,
									teacherId: filters.teacherId || undefined,
								})
							}
							variant="outline"
						>
							<CheckCheck className="size-4" />
							Approve all ({pendingCount})
						</Button>
					)}
					<Button disabled={teacherOptions.length === 0} onClick={openCreate}>
						<Plus className="size-4" />
						Record Session
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<SummaryCard label="Sessions" value={String(sessions.length)} />
				<SummaryCard label="Pending approval" value={String(pendingCount)} />
				<SummaryCard label="Total hours" value={formatDuration(totals.minutes)} />
				<SummaryCard label="Approved payout" value={currency.format(totals.approvedAmount)} />
			</div>

			{sessions.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-10 text-center">
					<p className="font-medium">No sessions for this period</p>
					<p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
						{teacherOptions.length === 0
							? "Add an active teacher first, then record sessions here."
							: "Record a session to see it here. Duration and payout are computed automatically."}
					</p>
				</div>
			) : (
				<>
					{/* Mobile card list */}
					<div className="md:hidden space-y-2">
						{sessions.map((session) => (
							<div key={session.id} className="rounded-lg border bg-card p-3 space-y-2">
								{/* Top row: title + amount */}
								<div className="flex items-start justify-between gap-3">
									<p className="truncate font-medium text-sm leading-none min-w-0">{session.title}</p>
									<span className="font-medium text-sm tabular-nums shrink-0">{currency.format(session.amount)}</span>
								</div>

								{/* Second row: teacher + date + status */}
								<div className="flex items-center justify-between gap-2">
									<p className="text-muted-foreground text-xs truncate min-w-0">
										{session.teacherName} · {formatDate(session.date)}
									</p>
									<SessionStatusBadge status={session.status} />
								</div>

								{/* Third row: time/duration + type */}
								<div className="flex items-center justify-between gap-2">
									<p className="text-muted-foreground text-xs">
										{formatTime(session.startTime)} – {formatTime(session.endTime)} · {formatDuration(session.durationMinutes)}
									</p>
									<Badge variant="secondary" className="text-xs shrink-0">{sessionTypeLabel(session.sessionType)}</Badge>
								</div>

								{/* Actions row */}
								<div className="flex items-center gap-1 pt-1 border-t">
									{session.status === "DRAFT" && (
										<>
											<Button
												className="text-emerald-600 hover:text-emerald-700"
												disabled={actionBusy}
												onClick={() => setSessionStatus.mutate({ id: session.id, status: "APPROVED" })}
												size="sm"
												variant="ghost"
												title="Approve"
											>
												<Check className="size-4" />
												<span className="sr-only">Approve</span>
											</Button>
											<Button
												className="text-destructive hover:text-destructive"
												disabled={actionBusy}
												onClick={() => setSessionStatus.mutate({ id: session.id, status: "REJECTED" })}
												size="sm"
												variant="ghost"
												title="Reject"
											>
												<X className="size-4" />
												<span className="sr-only">Reject</span>
											</Button>
										</>
									)}
									{session.status === "REJECTED" && (
										<Button
											disabled={actionBusy}
											onClick={() => setSessionStatus.mutate({ id: session.id, status: "APPROVED" })}
											size="sm"
											variant="ghost"
											title="Approve"
										>
											<Check className="size-4 text-emerald-600" />
											<span className="sr-only">Approve</span>
										</Button>
									)}
									<Button onClick={() => openEdit(session)} size="sm" variant="ghost">
										<Pencil className="size-4" />
										<span className="sr-only">Edit</span>
									</Button>
									<Button
										disabled={deleteSession.isPending}
										onClick={() => {
											if (confirm(`Delete session "${session.title}"?`)) {
												deleteSession.mutate({ id: session.id });
											}
										}}
										size="sm"
										variant="ghost"
									>
										<Trash2 className="size-4 text-destructive" />
										<span className="sr-only">Delete</span>
									</Button>
								</div>
							</div>
						))}
					</div>

					{/* Desktop table */}
					<div className="hidden md:block rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Title</TableHead>
									<TableHead>Teacher</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Time</TableHead>
									<TableHead className="text-right">Duration</TableHead>
									<TableHead className="text-right">Payout</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sessions.map((session) => (
									<TableRow key={session.id}>
										<TableCell className="whitespace-nowrap">
											{formatDate(session.date)}
										</TableCell>
										<TableCell className="font-medium">{session.title}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{session.teacherName}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">
												{sessionTypeLabel(session.sessionType)}
											</Badge>
										</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
											{formatTime(session.startTime)} – {formatTime(session.endTime)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{formatDuration(session.durationMinutes)}
										</TableCell>
										<TableCell className="text-right font-medium tabular-nums">
											{currency.format(session.amount)}
										</TableCell>
										<TableCell>
											<SessionStatusBadge status={session.status} />
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												{session.status === "DRAFT" && (
													<>
														<Button
															className="text-emerald-600 hover:text-emerald-700"
															disabled={actionBusy}
															onClick={() =>
																setSessionStatus.mutate({ id: session.id, status: "APPROVED" })
															}
															size="sm"
															variant="ghost"
															title="Approve"
														>
															<Check className="size-4" />
															<span className="sr-only">Approve</span>
														</Button>
														<Button
															className="text-destructive hover:text-destructive"
															disabled={actionBusy}
															onClick={() =>
																setSessionStatus.mutate({ id: session.id, status: "REJECTED" })
															}
															size="sm"
															variant="ghost"
															title="Reject"
														>
															<X className="size-4" />
															<span className="sr-only">Reject</span>
														</Button>
													</>
												)}
												{session.status === "REJECTED" && (
													<Button
														disabled={actionBusy}
														onClick={() =>
															setSessionStatus.mutate({ id: session.id, status: "APPROVED" })
														}
														size="sm"
														variant="ghost"
														title="Approve"
													>
														<Check className="size-4 text-emerald-600" />
														<span className="sr-only">Approve</span>
													</Button>
												)}
												<Button
													onClick={() => openEdit(session)}
													size="sm"
													variant="ghost"
												>
													<Pencil className="size-4" />
													<span className="sr-only">Edit</span>
												</Button>
												<Button
													disabled={deleteSession.isPending}
													onClick={() => {
														if (confirm(`Delete session "${session.title}"?`)) {
															deleteSession.mutate({ id: session.id });
														}
													}}
													size="sm"
													variant="ghost"
												>
													<Trash2 className="size-4 text-destructive" />
													<span className="sr-only">Delete</span>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</>
			)}

			<SessionFormSheet
				onOpenChange={setOpen}
				onSaved={() => router.refresh()}
				open={open}
				session={editing}
				teacherOptions={teacherOptions}
			/>
		</div>
	);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-4">
			<p className="text-muted-foreground text-sm">{label}</p>
			<p className="mt-1 font-semibold text-2xl tabular-nums">{value}</p>
		</div>
	);
}

function SessionStatusBadge({ status }: { status: SessionRow["status"] }) {
	if (status === "APPROVED") {
		return <Badge variant="default">approved</Badge>;
	}
	if (status === "REJECTED") {
		return <Badge variant="destructive">rejected</Badge>;
	}
	return <Badge variant="secondary">pending</Badge>;
}
