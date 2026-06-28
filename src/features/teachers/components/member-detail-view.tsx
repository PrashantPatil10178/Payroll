"use client";

import {
	BadgeIndianRupee,
	Building2,
	Calendar,
	Camera,
	CreditCard,
	Mail,
	Pencil,
	Phone,
	QrCode,
	User,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
			{children}
		</p>
	);
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
	if (!value) return null;
	return (
		<div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
			<span className="text-sm text-muted-foreground shrink-0">{label}</span>
			<span className="text-sm font-medium text-right break-all">{value}</span>
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
		<div className="mt-3 inline-block rounded-xl border bg-white p-2">
			<Image src={data.url} alt="Payment QR" width={140} height={140} className="rounded-lg" />
		</div>
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
					<div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
				))}
			</div>
		);
	}

	const sessions = data ?? [];

	if (sessions.length === 0) {
		return (
			<div className="rounded-xl border border-dashed bg-muted/30 py-10 text-center">
				<p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{sessions.slice(0, 30).map((session) => {
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
						className="flex items-start justify-between gap-4 rounded-xl border bg-card p-4"
					>
						<div className="min-w-0 space-y-1">
							<p className="font-medium truncate">{session.title}</p>
							<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
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
						<div className="flex flex-col items-end gap-1.5 shrink-0">
							<span className="font-semibold tabular-nums">
								{currency.format(Number(session.amount))}
							</span>
							<span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", statusColor)}>
								{session.status.toLowerCase()}
							</span>
						</div>
					</div>
				);
			})}
			{sessions.length > 30 && (
				<p className="text-xs text-muted-foreground text-center pt-1">
					Showing latest 30 of {sessions.length} sessions
				</p>
			)}
		</div>
	);
}

export function MemberDetailView({ teacher }: { teacher: TeacherRow }) {
	const [editOpen, setEditOpen] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const avatarUrl = api.efms.getTeacherAvatarUrl.useQuery(
		{ teacherId: teacher.id },
		{ enabled: !!teacher.avatarKey, staleTime: 1000 * 60 * 60 },
	);
	const uploadAvatar = api.efms.uploadTeacherAvatar.useMutation({
		onSuccess: () => { toast.success("Photo updated."); void avatarUrl.refetch(); },
		onError: (err) => toast.error(err.message),
	});
	const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			uploadAvatar.mutate({ teacherId: teacher.id, dataUrl: reader.result as string });
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const isFreelancer = teacher.memberType === "FREELANCER";
	const statusVariant =
		teacher.status === "ACTIVE"
			? "default"
			: teacher.status === "INACTIVE"
				? "secondary"
				: "outline";

	const hasBank = teacher.bankAccountNumber || teacher.bankIfsc || teacher.bankName;
	const hasUpi = teacher.upiId || teacher.paymentQrCodeKey;

	return (
		<>
			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				{/* Left column: Session history */}
				<div className="space-y-4 order-2 lg:order-1">
					<div className="flex items-center gap-2">
						<Calendar className="size-4 text-muted-foreground" />
						<SectionTitle>Session history</SectionTitle>
					</div>
					<SessionTimeline teacherId={teacher.id} />
				</div>

				{/* Right column: Profile + Rates + Payment */}
				<div className="space-y-5 order-1 lg:order-2">

					{/* Profile card */}
					<div className="rounded-xl border bg-card p-5">
						<div className="flex items-start gap-4 mb-4">
							{/* Avatar with upload */}
							<div className="relative shrink-0">
								{avatarUrl.data?.url ? (
									<Image
										src={avatarUrl.data.url}
										alt={teacher.fullName}
										width={72}
										height={72}
										className="size-18 rounded-full object-cover ring-2 ring-border"
									/>
								) : (
									<div className="flex size-18 items-center justify-center rounded-full bg-muted ring-2 ring-border">
										<User className="size-7 text-muted-foreground" />
									</div>
								)}
								<button
									type="button"
									onClick={() => avatarInputRef.current?.click()}
									className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
									title="Change photo"
								>
									<Camera className="size-3.5" />
								</button>
								<input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
							</div>

							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-2">
									<div>
										<div className="flex items-center gap-2 flex-wrap">
											<h2 className="text-lg font-semibold leading-tight">{teacher.fullName}</h2>
											<Badge variant={statusVariant}>{teacher.status.toLowerCase()}</Badge>
										</div>
										<p className="mt-0.5 font-mono text-xs text-muted-foreground">
											{teacher.teacherCode}
											{teacher.roleTitle && (
												<span className="ml-2 font-sans">· {teacher.roleTitle}</span>
											)}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{isFreelancer ? "Freelancer / Contractor" : "Teacher / Faculty"}
										</p>
									</div>
									<Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="shrink-0">
										<Pencil className="size-3.5" />
										Edit
									</Button>
								</div>
							</div>
						</div>

						<div>
							<InfoRow label="Email" value={teacher.email} />
							<InfoRow label="Mobile" value={teacher.mobile} />
							<InfoRow
								label={isFreelancer ? "Skills / Services" : "Specialization"}
								value={teacher.specialization}
							/>
						</div>
					</div>

					{/* Rates card */}
					{teacher.rates && (
						<div className="rounded-xl border bg-card p-5">
							<SectionTitle>
								<span className="flex items-center gap-1.5">
									<BadgeIndianRupee className="size-3.5" />
									{isFreelancer ? "Rate" : "Payout rates"}
								</span>
							</SectionTitle>

							{isFreelancer ? (
								<div className="rounded-lg border bg-muted/30 p-4">
									<p className="text-xs text-muted-foreground">Flat rate</p>
									<p className="mt-1 text-2xl font-bold tabular-nums">
										{currency.format(teacher.rates.liveRate)}
									</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										{teacher.rates.liveRateUnit === "PER_HOUR" ? "per hour" : "per session / project"}
									</p>
								</div>
							) : (
								<div className="grid grid-cols-2 gap-2">
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
										<div key={label} className="rounded-lg border bg-muted/30 p-3">
											<p className="text-xs text-muted-foreground">{label}</p>
											<p className="mt-0.5 font-bold tabular-nums">
												{currency.format(value)}
											</p>
											<p className="text-[10px] text-muted-foreground">
												{unit === "PER_HOUR" ? "/ hr" : "/ session"}
											</p>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Payment details card */}
					{(hasBank || hasUpi || teacher.panNumber) && (
						<div className="rounded-xl border bg-card p-5">
							<SectionTitle>Payment details</SectionTitle>

							{hasUpi && (
								<div className="mb-4">
									<div className="flex items-center gap-1.5 mb-1">
										<QrCode className="size-3.5 text-muted-foreground" />
										<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">UPI</p>
									</div>
									{teacher.upiId && (
										<p className="font-mono text-sm">{teacher.upiId}</p>
									)}
									{teacher.paymentQrCodeKey && <QrImage teacherId={teacher.id} />}
								</div>
							)}

							{hasBank && (
								<div className={cn(hasUpi && "border-t pt-4")}>
									<div className="flex items-center gap-1.5 mb-2">
										<Building2 className="size-3.5 text-muted-foreground" />
										<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bank transfer</p>
									</div>
									<InfoRow label="Bank" value={teacher.bankName} />
									<InfoRow label="Account" value={teacher.bankAccountNumber} />
									<InfoRow label="IFSC" value={teacher.bankIfsc} />
								</div>
							)}

							{teacher.panNumber && (
								<div className={cn((hasBank || hasUpi) && "border-t pt-4 mt-2")}>
									<div className="flex items-center gap-1.5 mb-1">
										<CreditCard className="size-3.5 text-muted-foreground" />
										<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax</p>
									</div>
									<InfoRow label="PAN" value={teacher.panNumber} />
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			<TeacherFormSheet
				open={editOpen}
				onOpenChange={setEditOpen}
				teacher={teacher}
				onSaved={() => setEditOpen(false)}
			/>
		</>
	);
}
