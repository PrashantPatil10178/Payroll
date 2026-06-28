"use client";

import {
	BadgeIndianRupee,
	CalendarDays,
	Clock,
	FileText,
	Paperclip,
	Timer,
	Trash2,
	User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import {
	FREELANCER_SESSION_TYPE_OPTIONS,
	SESSION_TYPE_OPTIONS,
	type SessionRow,
	type TeacherOption,
} from "../types";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (iso: string) => {
	const d = new Date(iso);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toTimeInput = (iso: string) => {
	const d = new Date(iso);
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type FormState = {
	teacherId: string;
	sessionType: string;
	title: string;
	date: string;
	startTime: string;
	endTime: string;
	durationHours: string;
	durationMinutes: string;
	rateOverride: string;
	remarks: string;
};

const emptyForm = (): FormState => ({
	teacherId: "",
	sessionType: "LIVE_CLASS",
	title: "",
	date: toDateInput(new Date().toISOString()),
	startTime: "",
	endTime: "",
	durationHours: "",
	durationMinutes: "",
	rateOverride: "",
	remarks: "",
});

function fromSession(session: SessionRow): FormState {
	return {
		teacherId: session.teacherId,
		sessionType: session.sessionType,
		title: session.title,
		date: toDateInput(session.date),
		startTime: toTimeInput(session.startTime),
		endTime: toTimeInput(session.endTime),
		durationHours: String(Math.floor(session.durationMinutes / 60)),
		durationMinutes: String(session.durationMinutes % 60),
		rateOverride: "",
		remarks: session.remarks ?? "",
	};
}

function getDefaultRate(member: TeacherOption | undefined, sessionType: string): number | null {
	if (!member?.rates) return null;
	const r = member.rates;
	switch (sessionType) {
		case "LIVE_CLASS": return r.liveRate;
		case "RECORDING": return r.recordingRate;
		case "YOUTUBE": return r.youtubeRate;
		case "DOUBT_SOLVING": return r.doubtRate ?? r.liveRate;
		case "WEBINAR": return r.webinarRate ?? r.liveRate;
		default: return r.liveRate;
	}
}

function SectionHeader({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ElementType;
	title: string;
	description?: string;
}) {
	return (
		<div className="flex items-start gap-3 pb-3">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
				<Icon className="size-4 text-muted-foreground" />
			</div>
			<div>
				<p className="font-semibold text-sm leading-tight">{title}</p>
				{description && (
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
				)}
			</div>
		</div>
	);
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={cn("rounded-xl border bg-muted/30 p-4 space-y-4", className)}>
			{children}
		</div>
	);
}

function FormField({
	label,
	htmlFor,
	children,
	optional,
}: {
	label: string;
	htmlFor: string;
	children: React.ReactNode;
	optional?: boolean;
}) {
	return (
		<div className="grid gap-1.5">
			<div className="flex items-center justify-between">
				<Label
					className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
					htmlFor={htmlFor}
				>
					{label}
				</Label>
				{optional && (
					<span className="text-[10px] text-muted-foreground/60">optional</span>
				)}
			</div>
			{children}
		</div>
	);
}

function AttachmentsSection({
	sessionId,
	initialKeys,
}: {
	sessionId: string;
	initialKeys: string[];
}) {
	const [keys, setKeys] = useState<string[]>(initialKeys);
	const inputRef = useRef<HTMLInputElement>(null);
	const addAttachment = api.efms.addSessionAttachment.useMutation();
	const removeAttachment = api.efms.removeSessionAttachment.useMutation();

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			addAttachment.mutate(
				{ sessionId, fileName: file.name, dataUrl: reader.result as string },
				{
					onSuccess: (data) => {
						setKeys((prev) => [...prev, data.key]);
						toast.success("Attachment uploaded.");
					},
					onError: (err) => toast.error(err.message),
				},
			);
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const handleRemove = (key: string) => {
		removeAttachment.mutate(
			{ sessionId, key },
			{
				onSuccess: () => {
					setKeys((prev) => prev.filter((k) => k !== key));
					toast.success("Attachment removed.");
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleOpenAttachment = async (key: string) => {
		const res = await fetch(`/api/attachment-url?key=${encodeURIComponent(key)}`);
		if (res.ok) {
			const { url } = (await res.json()) as { url: string };
			window.open(url, "_blank");
		}
	};

	const fileName = (key: string) => key.split("/").pop() ?? key;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					Attachments
				</Label>
				<button
					className="text-muted-foreground transition-colors hover:text-foreground"
					onClick={() => inputRef.current?.click()}
					title="Upload attachment"
					type="button"
				>
					<Paperclip className="size-4" />
				</button>
				<input className="hidden" onChange={handleFile} ref={inputRef} type="file" />
			</div>
			{keys.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					No attachments. Click the paperclip to upload.
				</p>
			) : (
				<ul className="space-y-1">
					{keys.map((key) => (
						<li
							className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs"
							key={key}
						>
							<button
								className="truncate text-left hover:underline"
								onClick={() => handleOpenAttachment(key)}
								type="button"
							>
								{fileName(key)}
							</button>
							<button
								className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
								onClick={() => handleRemove(key)}
								type="button"
							>
								<Trash2 className="size-3" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function SessionFormSheet({
	onOpenChange,
	onSaved,
	open,
	session,
	teacherOptions,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	session: SessionRow | null;
	teacherOptions: TeacherOption[];
	onSaved: () => void;
}) {
	const isEdit = session !== null;
	const [form, setForm] = useState<FormState>(emptyForm);

	useEffect(() => {
		if (open) {
			setForm(session ? fromSession(session) : emptyForm());
		}
	}, [open, session]);

	const set = (key: keyof FormState, value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const manualDurationMinutes = useMemo(() => {
		const hours = Number(form.durationHours || 0);
		const minutes = Number(form.durationMinutes || 0);
		if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) {
			return 0;
		}
		return hours * 60 + minutes;
	}, [form.durationHours, form.durationMinutes]);

	const timeRangeDurationMinutes = useMemo(() => {
		if (!(form.date && form.startTime && form.endTime)) return null;
		const start = new Date(`${form.date}T${form.startTime}`);
		const end = new Date(`${form.date}T${form.endTime}`);
		const diff = (end.getTime() - start.getTime()) / 60000;
		return Number.isFinite(diff) ? Math.round(diff) : null;
	}, [form.date, form.startTime, form.endTime]);

	const effectiveDurationMinutes =
		manualDurationMinutes > 0 ? manualDurationMinutes : timeRangeDurationMinutes;

	const selectedMember = teacherOptions.find((t) => t.id === form.teacherId);
	const isFreelancer = selectedMember?.memberType === "FREELANCER";
	const sessionTypeOptions = isFreelancer ? FREELANCER_SESSION_TYPE_OPTIONS : SESSION_TYPE_OPTIONS;

	const defaultRate = getDefaultRate(selectedMember, form.sessionType);
	const effectiveRate = form.rateOverride.trim() !== "" ? Number(form.rateOverride) : defaultRate;
	const previewAmount =
		effectiveRate != null && effectiveDurationMinutes != null && effectiveDurationMinutes > 0
			? (effectiveRate * effectiveDurationMinutes) / 60
			: null;

	const handleSuccess = (message: string) => {
		toast.success(message);
		onOpenChange(false);
		onSaved();
	};

	const createSession = api.efms.createSession.useMutation({
		onSuccess: () => handleSuccess("Session recorded."),
		onError: (error) => toast.error(error.message),
	});
	const updateSession = api.efms.updateSession.useMutation({
		onSuccess: () => handleSuccess("Session updated."),
		onError: (error) => toast.error(error.message),
	});
	const isPending = createSession.isPending || updateSession.isPending;

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();

		if (!form.teacherId) {
			toast.error("Select a member.");
			return;
		}
		if (!effectiveDurationMinutes || effectiveDurationMinutes <= 0) {
			toast.error("Enter a valid duration or start/end time.");
			return;
		}

		const date = new Date(`${form.date}T00:00`);
		const startTime =
			form.startTime.trim() !== "" ? new Date(`${form.date}T${form.startTime}`) : undefined;
		const endTime =
			form.endTime.trim() !== "" ? new Date(`${form.date}T${form.endTime}`) : undefined;

		const rateOverride =
			form.rateOverride.trim() !== "" && defaultRate !== null && Number(form.rateOverride) !== defaultRate
				? Number(form.rateOverride)
				: undefined;

		const payload = {
			teacherId: form.teacherId,
			sessionType: form.sessionType as SessionRow["sessionType"],
			title: form.title.trim(),
			date,
			startTime,
			endTime,
			durationMinutes: manualDurationMinutes > 0 ? manualDurationMinutes : undefined,
			rateOverride,
			remarks: form.remarks.trim() || undefined,
		};

		if (isEdit && session) {
			updateSession.mutate({ id: session.id, ...payload, remarks: form.remarks.trim() });
		} else {
			createSession.mutate(payload);
		}
	};

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="flex flex-col gap-0 overflow-hidden p-0 w-full sm:max-w-md">
				{/* Fixed header */}
				<div className="border-b px-6 py-4">
					<SheetTitle className="text-base font-semibold">
						{isEdit ? "Edit session" : "Record session"}
					</SheetTitle>
					<p className="mt-0.5 text-muted-foreground text-xs">
						Duration can come from direct entry or start/end times.
					</p>
				</div>

				{/* Scrollable body */}
				<form id="session-form" className="flex-1 overflow-y-auto" onSubmit={handleSubmit}>
					<div className="space-y-5 px-6 py-5">

						{/* Section: Who & What */}
						<div>
							<SectionHeader
								icon={User}
								title="Who & What"
								description="Member and session type"
							/>
							<FieldGroup>
								<FormField label="Member" htmlFor="teacherId">
									<Select
										onValueChange={(value) => {
											const member = teacherOptions.find((t) => t.id === value);
											const opts = member?.memberType === "FREELANCER" ? FREELANCER_SESSION_TYPE_OPTIONS : SESSION_TYPE_OPTIONS;
											setForm((prev) => ({ ...prev, teacherId: value, sessionType: opts[0]!.value }));
										}}
										value={form.teacherId}
									>
										<SelectTrigger id="teacherId">
											<SelectValue placeholder="Select a member" />
										</SelectTrigger>
										<SelectContent>
											{teacherOptions.length === 0 ? (
												<div className="px-2 py-1.5 text-muted-foreground text-sm">
													No active members
												</div>
											) : (
												teacherOptions.map((t) => (
													<SelectItem key={t.id} value={t.id}>
														<span>{t.fullName} ({t.teacherCode})</span>
														{t.memberType === "FREELANCER" && (
															<span className="ml-1.5 text-xs text-muted-foreground">· Freelancer</span>
														)}
													</SelectItem>
												))
											)}
										</SelectContent>
									</Select>
								</FormField>

								<FormField label="Session type" htmlFor="sessionType">
									<Select onValueChange={(value) => set("sessionType", value)} value={form.sessionType}>
										<SelectTrigger id="sessionType">
											<SelectValue placeholder="Select a type" />
										</SelectTrigger>
										<SelectContent>
											{sessionTypeOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormField>

								<FormField label="Title" htmlFor="title">
									<Input
										id="title"
										onChange={(e) => set("title", e.target.value)}
										placeholder="e.g. Thermodynamics – Chapter 4"
										required
										value={form.title}
									/>
								</FormField>
							</FieldGroup>
						</div>

						{/* Section: When & Duration */}
						<div>
							<SectionHeader
								icon={CalendarDays}
								title="When & Duration"
								description="Date, time range, and duration"
							/>
							<FieldGroup>
								<FormField label="Date" htmlFor="date">
									<Input
										id="date"
										onChange={(e) => set("date", e.target.value)}
										required
										type="date"
										value={form.date}
									/>
								</FormField>

								<div className="space-y-1.5">
									<div className="flex items-center gap-2">
										<Timer className="size-3.5 text-muted-foreground" />
										<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Direct duration
										</span>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<FormField label="Hours" htmlFor="durationHours">
											<Input
												id="durationHours"
												min={0}
												onChange={(e) => set("durationHours", e.target.value)}
												placeholder="0"
												type="number"
												value={form.durationHours}
											/>
										</FormField>
										<FormField label="Minutes" htmlFor="durationMinutes">
											<Input
												id="durationMinutes"
												max={59}
												min={0}
												onChange={(e) => set("durationMinutes", e.target.value)}
												placeholder="40"
												type="number"
												value={form.durationMinutes}
											/>
										</FormField>
									</div>
								</div>

								<div className="space-y-1.5">
									<div className="flex items-center gap-2">
										<Clock className="size-3.5 text-muted-foreground" />
										<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Or time range
										</span>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<FormField label="Start time" htmlFor="startTime" optional>
											<Input
												id="startTime"
												onChange={(e) => set("startTime", e.target.value)}
												type="time"
												value={form.startTime}
											/>
										</FormField>
										<FormField label="End time" htmlFor="endTime" optional>
											<Input
												id="endTime"
												onChange={(e) => set("endTime", e.target.value)}
												type="time"
												value={form.endTime}
											/>
										</FormField>
									</div>
								</div>

								{effectiveDurationMinutes != null && effectiveDurationMinutes > 0 && (
									<div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
										{Math.floor(effectiveDurationMinutes / 60)}h {effectiveDurationMinutes % 60}m
									</div>
								)}
								{effectiveDurationMinutes != null && effectiveDurationMinutes <= 0 && (
									<div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
										Enter a valid duration
									</div>
								)}
							</FieldGroup>
						</div>

						{/* Section: Rate */}
						{selectedMember && (
							<div>
								<SectionHeader
									icon={BadgeIndianRupee}
									title="Rate & Payout"
									description="Override the default rate for this session"
								/>
								<FieldGroup>
									<FormField label="Rate per hour" htmlFor="rateOverride">
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
											<Input
												id="rateOverride"
												className="pl-7"
												type="number"
												min={0}
												step="0.01"
												placeholder={defaultRate != null ? String(defaultRate) : "Default rate"}
												value={form.rateOverride}
												onChange={(e) => set("rateOverride", e.target.value)}
											/>
										</div>
										{defaultRate != null && (
											<p className="text-xs text-muted-foreground mt-1">
												Default: ₹{defaultRate.toLocaleString("en-IN")}/hr
												{form.rateOverride.trim() !== "" && Number(form.rateOverride) !== defaultRate && (
													<button
														type="button"
														className="ml-2 underline hover:no-underline"
														onClick={() => set("rateOverride", "")}
													>
														Reset
													</button>
												)}
											</p>
										)}
									</FormField>

									{previewAmount != null && (
										<div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
											<div>
												<p className="text-xs text-muted-foreground">Estimated payout</p>
												{form.rateOverride.trim() !== "" && Number(form.rateOverride) !== defaultRate && (
													<p className="text-[10px] text-amber-600 mt-0.5">Custom rate applied</p>
												)}
											</div>
											<p className="text-xl font-bold tabular-nums">
												₹{Math.round(previewAmount).toLocaleString("en-IN")}
											</p>
										</div>
									)}
								</FieldGroup>
							</div>
						)}

						{/* Section: Notes & Attachments */}
						<div>
							<SectionHeader
								icon={FileText}
								title="Notes & Attachments"
								description="Remarks and supporting files"
							/>
							<FieldGroup>
								<FormField label="Remarks" htmlFor="remarks" optional>
									<Textarea
										id="remarks"
										onChange={(e) => set("remarks", e.target.value)}
										placeholder="Optional notes about this session"
										value={form.remarks}
										rows={3}
									/>
								</FormField>

								{isEdit && session && (
									<AttachmentsSection
										initialKeys={session.attachments ?? []}
										sessionId={session.id}
									/>
								)}
							</FieldGroup>
						</div>
					</div>
				</form>

				{/* Sticky footer */}
				<div className="sticky bottom-0 border-t bg-background px-6 py-4 flex gap-2">
					<Button form="session-form"
						className="flex-1"
						disabled={isPending}
						isLoading={isPending}
						type="submit"
					>
						{isEdit ? "Save changes" : "Record session"}
					</Button>
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">
						Cancel
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
