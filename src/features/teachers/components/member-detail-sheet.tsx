"use client";

import {
	Building2,
	Calendar,
	CreditCard,
	Mail,
	Pencil,
	Phone,
	QrCode,
	User,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { sessionTypeLabel } from "@/features/sessions/types";
import { TeacherFormSheet } from "./teacher-form-sheet";
import type { TeacherRow } from "../types";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

function DetailRow({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ElementType;
	label: string;
	value: string | null | undefined;
}) {
	if (!value) return null;
	return (
		<div className="flex items-start gap-3">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<div className="min-w-0">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="mt-0.5 text-sm font-medium break-all">{value}</p>
			</div>
		</div>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
			{children}
		</p>
	);
}

function SessionTimeline({ teacherId }: { teacherId: string }) {
	const { data, isLoading } = api.efms.listSessions.useQuery(
		{ teacherId },
		{ staleTime: 1000 * 60 * 5 },
	);

	if (isLoading) {
		return (
			<div className="space-y-2">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
				))}
			</div>
		);
	}

	const sessions = data ?? [];

	if (sessions.length === 0) {
		return (
			<p className="text-sm text-muted-foreground text-center py-6">
				No sessions recorded yet.
			</p>
		);
	}

	return (
		<div className="space-y-2">
			{sessions.slice(0, 20).map((session) => {
				const date = new Date(session.date);
				const statusColor =
					session.status === "APPROVED"
						? "text-green-600 bg-green-50 dark:bg-green-950/30"
						: session.status === "REJECTED"
							? "text-red-600 bg-red-50 dark:bg-red-950/30"
							: "text-muted-foreground bg-muted/50";
				return (
					<div
						key={session.id}
						className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
					>
						<div className="min-w-0 space-y-0.5">
							<p className="text-sm font-medium truncate">{session.title}</p>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>{sessionTypeLabel(session.sessionType)}</span>
								<span>·</span>
								<span>
									{date.toLocaleDateString("en-IN", {
										day: "numeric",
										month: "short",
										year: "numeric",
									})}
								</span>
								<span>·</span>
								<span>
									{Math.floor(session.durationMinutes / 60)}h{" "}
									{session.durationMinutes % 60}m
								</span>
							</div>
						</div>
						<div className="flex flex-col items-end gap-1 shrink-0">
							<span className="text-sm font-semibold tabular-nums">
								{currency.format(Number(session.amount))}
							</span>
							<span className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", statusColor)}>
								{session.status.toLowerCase()}
							</span>
						</div>
					</div>
				);
			})}
			{sessions.length > 20 && (
				<p className="text-xs text-muted-foreground text-center pt-1">
					Showing latest 20 of {sessions.length} sessions
				</p>
			)}
		</div>
	);
}

function QrImage({ teacherId }: { teacherId: string }) {
	const { data } = api.efms.getTeacherPaymentQrUrl.useQuery(
		{ teacherId },
		{ staleTime: 1000 * 60 * 60 },
	);
	if (!data?.url) return null;
	return (
		<div className="mt-2 rounded-lg border p-2 inline-block bg-white">
			<Image src={data.url} alt="Payment QR" width={120} height={120} className="rounded" />
		</div>
	);
}

export function MemberDetailSheet({
	teacher,
	open,
	onOpenChange,
	onEdited,
}: {
	teacher: TeacherRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEdited: () => void;
}) {
	const [editOpen, setEditOpen] = useState(false);

	if (!teacher) return null;

	const statusColor =
		teacher.status === "ACTIVE"
			? "default"
			: teacher.status === "INACTIVE"
				? "secondary"
				: "outline";

	const hasBank = teacher.bankAccountNumber || teacher.bankIfsc || teacher.bankName;
	const hasUpi = teacher.upiId || teacher.paymentQrCodeKey;

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent className="flex flex-col gap-0 overflow-hidden p-0 w-full sm:max-w-lg">
					{/* Header */}
					<div className="border-b px-6 py-4 flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<SheetTitle className="text-base font-semibold">
									{teacher.fullName}
								</SheetTitle>
								<Badge variant={statusColor}>{teacher.status.toLowerCase()}</Badge>
							</div>
							<p className="mt-0.5 font-mono text-xs text-muted-foreground">
								{teacher.teacherCode}
								{teacher.roleTitle && (
									<span className="ml-2 font-sans not-italic">· {teacher.roleTitle}</span>
								)}
							</p>
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setEditOpen(true)}
							className="shrink-0"
						>
							<Pencil className="size-3.5" />
							Edit
						</Button>
					</div>

					{/* Scrollable body */}
					<div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
						{/* Profile */}
						<div>
							<SectionTitle>Profile</SectionTitle>
							<div className="rounded-xl border bg-muted/30 p-4 space-y-3">
								<DetailRow icon={User} label="Full name" value={teacher.fullName} />
								<DetailRow icon={User} label="Specialization" value={teacher.specialization} />
								<DetailRow icon={Mail} label="Email" value={teacher.email} />
								<DetailRow icon={Phone} label="Mobile" value={teacher.mobile} />
							</div>
						</div>

						{/* Payout rates */}
						{teacher.rates && (
							<div>
								<SectionTitle>Payout rates</SectionTitle>
								<div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-2 gap-3">
									{[
										{ label: "Live", value: teacher.rates.liveRate, unit: teacher.rates.liveRateUnit },
										{ label: "Recording", value: teacher.rates.recordingRate, unit: teacher.rates.recordingRateUnit },
										{ label: "YouTube", value: teacher.rates.youtubeRate, unit: teacher.rates.youtubeRateUnit },
										...(teacher.rates.doubtRate != null
											? [{ label: "Doubt", value: teacher.rates.doubtRate, unit: teacher.rates.doubtRateUnit }]
											: []),
										...(teacher.rates.webinarRate != null
											? [{ label: "Webinar", value: teacher.rates.webinarRate, unit: teacher.rates.webinarRateUnit }]
											: []),
									].map(({ label, value, unit }) => (
										<div key={label} className="rounded-lg border bg-background p-2.5">
											<p className="text-xs text-muted-foreground">{label}</p>
											<p className="mt-0.5 font-semibold tabular-nums text-sm">
												{currency.format(value)}
											</p>
											<p className="text-[10px] text-muted-foreground">
												{unit === "PER_HOUR" ? "/ hr" : "/ session"}
											</p>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Payment details */}
						{(hasBank || hasUpi) && (
							<div>
								<SectionTitle>Payment details</SectionTitle>
								<div className="rounded-xl border bg-muted/30 p-4 space-y-4">
									{hasUpi && (
										<div>
											<div className="flex items-center gap-2 mb-1">
												<QrCode className="size-4 text-muted-foreground" />
												<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
													UPI
												</p>
											</div>
											{teacher.upiId && (
												<p className="text-sm font-mono">{teacher.upiId}</p>
											)}
											{teacher.paymentQrCodeKey && (
												<QrImage teacherId={teacher.id} />
											)}
										</div>
									)}
									{hasBank && (
										<div>
											<div className="flex items-center gap-2 mb-2">
												<Building2 className="size-4 text-muted-foreground" />
												<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
													Bank transfer
												</p>
											</div>
											<div className="space-y-1.5">
												{teacher.bankName && (
													<div className="flex items-center justify-between text-sm">
														<span className="text-muted-foreground">Bank</span>
														<span className="font-medium">{teacher.bankName}</span>
													</div>
												)}
												{teacher.bankAccountNumber && (
													<div className="flex items-center justify-between text-sm">
														<span className="text-muted-foreground">Account</span>
														<span className="font-mono">{teacher.bankAccountNumber}</span>
													</div>
												)}
												{teacher.bankIfsc && (
													<div className="flex items-center justify-between text-sm">
														<span className="text-muted-foreground">IFSC</span>
														<span className="font-mono">{teacher.bankIfsc}</span>
													</div>
												)}
											</div>
										</div>
									)}
									{teacher.panNumber && (
										<div className="flex items-center gap-2">
											<CreditCard className="size-4 text-muted-foreground" />
											<p className="text-xs text-muted-foreground uppercase tracking-wide">PAN</p>
											<p className="ml-auto font-mono text-sm">{teacher.panNumber}</p>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Session timeline */}
						<div>
							<div className="flex items-center gap-2 mb-3">
								<Calendar className="size-3.5 text-muted-foreground" />
								<SectionTitle>Session history</SectionTitle>
							</div>
							<SessionTimeline teacherId={teacher.id} />
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Edit sheet */}
			<TeacherFormSheet
				open={editOpen}
				onOpenChange={setEditOpen}
				teacher={teacher}
				onSaved={() => {
					setEditOpen(false);
					onOpenChange(false);
					onEdited();
				}}
			/>
		</>
	);
}
