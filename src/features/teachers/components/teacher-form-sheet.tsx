"use client";

import {
	BadgeIndianRupee,
	Building2,
	Camera,
	ExternalLink,
	QrCode,
	Upload,
	User,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import type { TeacherRow } from "../types";
import { TEACHER_STATUS_OPTIONS } from "../types";

type RateUnitValue = "PER_HOUR" | "PER_SESSION";

type FormState = {
	teacherCode: string;
	fullName: string;
	memberType: "TEACHER" | "FREELANCER";
	roleTitle: string;
	email: string;
	mobile: string;
	specialization: string;
	status: string;
	bankAccountNumber: string;
	bankIfsc: string;
	bankName: string;
	panNumber: string;
	upiId: string;
	liveRate: string;
	liveRateUnit: RateUnitValue;
	recordingRate: string;
	recordingRateUnit: RateUnitValue;
	youtubeRate: string;
	youtubeRateUnit: RateUnitValue;
	doubtRate: string;
	doubtRateUnit: RateUnitValue;
	webinarRate: string;
	webinarRateUnit: RateUnitValue;
	paymentQrCodeDataUrl?: string;
	paymentQrCodeFileName?: string;
};

const EMPTY: FormState = {
	teacherCode: "",
	fullName: "",
	memberType: "TEACHER",
	roleTitle: "",
	email: "",
	mobile: "",
	specialization: "",
	status: "ACTIVE",
	bankAccountNumber: "",
	bankIfsc: "",
	bankName: "",
	panNumber: "",
	upiId: "",
	liveRate: "",
	liveRateUnit: "PER_HOUR",
	recordingRate: "",
	recordingRateUnit: "PER_HOUR",
	youtubeRate: "",
	youtubeRateUnit: "PER_HOUR",
	doubtRate: "",
	doubtRateUnit: "PER_HOUR",
	webinarRate: "",
	webinarRateUnit: "PER_HOUR",
};

const RATE_UNIT_OPTIONS: { value: RateUnitValue; label: string }[] = [
	{ value: "PER_HOUR", label: "Per hour" },
	{ value: "PER_SESSION", label: "Per session / qty" },
];

function fromTeacher(teacher: TeacherRow): FormState {
	return {
		teacherCode: teacher.teacherCode,
		fullName: teacher.fullName,
		memberType: teacher.memberType as "TEACHER" | "FREELANCER",
		roleTitle: teacher.roleTitle ?? "",
		email: teacher.email ?? "",
		mobile: teacher.mobile ?? "",
		specialization: teacher.specialization ?? "",
		status: teacher.status,
		bankAccountNumber: teacher.bankAccountNumber ?? "",
		bankIfsc: teacher.bankIfsc ?? "",
		bankName: teacher.bankName ?? "",
		panNumber: teacher.panNumber ?? "",
		upiId: teacher.upiId ?? "",
		liveRate: teacher.rates ? String(teacher.rates.liveRate) : "",
		liveRateUnit: teacher.rates?.liveRateUnit ?? "PER_HOUR",
		recordingRate: teacher.rates ? String(teacher.rates.recordingRate) : "",
		recordingRateUnit: teacher.rates?.recordingRateUnit ?? "PER_HOUR",
		youtubeRate: teacher.rates ? String(teacher.rates.youtubeRate) : "",
		youtubeRateUnit: teacher.rates?.youtubeRateUnit ?? "PER_HOUR",
		doubtRate:
			teacher.rates?.doubtRate != null ? String(teacher.rates.doubtRate) : "",
		doubtRateUnit: teacher.rates?.doubtRateUnit ?? "PER_HOUR",
		webinarRate:
			teacher.rates?.webinarRate != null
				? String(teacher.rates.webinarRate)
				: "",
		webinarRateUnit: teacher.rates?.webinarRateUnit ?? "PER_HOUR",
	};
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
		<div className={cn("rounded-xl border bg-muted/30 p-4", className)}>
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
				<Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide" htmlFor={htmlFor}>
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

function RateField({
	form,
	id,
	label,
	onRateChange,
	onUnitChange,
	placeholder,
	rateKey,
	unitKey,
	required = false,
}: {
	form: FormState;
	id: string;
	label: string;
	onRateChange: (value: string) => void;
	onUnitChange: (value: RateUnitValue) => void;
	placeholder?: string;
	rateKey: keyof FormState;
	unitKey: keyof FormState;
	required?: boolean;
}) {
	return (
		<div className="grid gap-1.5">
			<div className="flex items-center justify-between">
				<Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide" htmlFor={id}>
					{label}
				</Label>
				{!required && (
					<span className="text-[10px] text-muted-foreground/60">optional</span>
				)}
			</div>
			<div className="grid grid-cols-[1fr_9rem] gap-2">
				<Input
					className="bg-background"
					id={id}
					min={0}
					onChange={(e) => onRateChange(e.target.value)}
					placeholder={placeholder ?? "0.00"}
					required={required}
					step="0.01"
					type="number"
					value={String(form[rateKey] ?? "")}
				/>
				<Select
					onValueChange={(value) => onUnitChange(value as RateUnitValue)}
					value={String(form[unitKey] ?? "PER_HOUR")}
				>
					<SelectTrigger className="bg-background">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{RATE_UNIT_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

export function TeacherFormSheet({
	onOpenChange,
	onSaved,
	open,
	teacher,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	teacher: TeacherRow | null;
	onSaved: () => void;
}) {
	const isEdit = teacher !== null;
	const [form, setForm] = useState<FormState>(EMPTY);
	const [qrUrl, setQrUrl] = useState<string | null>(null);
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const nextTeacherCode = api.efms.nextTeacherCode.useQuery(undefined, {
		enabled: open && !isEdit,
		staleTime: 30_000,
	});
	const paymentQr = api.efms.getTeacherPaymentQrUrl.useQuery(
		{ teacherId: teacher?.id ?? "" },
		{
			enabled: open && !!teacher?.id && !!teacher?.paymentQrCodeKey,
			staleTime: 60_000,
		},
	);
	const avatarUrl = api.efms.getTeacherAvatarUrl.useQuery(
		{ teacherId: teacher?.id ?? "" },
		{
			enabled: open && !!teacher?.id && !!teacher?.avatarKey,
			staleTime: 1000 * 60 * 60,
		},
	);
	const uploadAvatar = api.efms.uploadTeacherAvatar.useMutation({
		onSuccess: () => { toast.success("Avatar updated."); void avatarUrl.refetch(); },
		onError: (err) => toast.error(err.message),
	});

	const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !teacher?.id) return;
		const reader = new FileReader();
		reader.onload = () => {
			uploadAvatar.mutate({ teacherId: teacher.id, dataUrl: reader.result as string });
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	useEffect(() => {
		if (open) {
			setForm(teacher ? fromTeacher(teacher) : EMPTY);
		}
	}, [open, teacher]);

	useEffect(() => {
		if (!isEdit && nextTeacherCode.data) {
			setForm((prev) => ({ ...prev, teacherCode: nextTeacherCode.data }));
		}
	}, [isEdit, nextTeacherCode.data]);

	useEffect(() => {
		setQrUrl(paymentQr.data?.url ?? null);
	}, [paymentQr.data?.url]);

	const handleSuccess = (message: string) => {
		toast.success(message);
		onOpenChange(false);
		onSaved();
	};

	const createTeacher = api.efms.createTeacher.useMutation({
		onSuccess: () => handleSuccess("Member added."),
		onError: (error) => toast.error(error.message),
	});
	const updateTeacher = api.efms.updateTeacher.useMutation({
		onSuccess: () => handleSuccess("Member updated."),
		onError: (error) => toast.error(error.message),
	});

	const isPending = createTeacher.isPending || updateTeacher.isPending;

	const set = (key: keyof FormState, value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const optionalNumber = (value: string) =>
		value.trim() === "" ? undefined : Number(value);

	const handleQrFile = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			setForm((prev) => ({
				...prev,
				paymentQrCodeDataUrl: reader.result as string,
				paymentQrCodeFileName: file.name,
			}));
			setQrUrl(reader.result as string);
		};
		reader.readAsDataURL(file);
		event.target.value = "";
	};

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();

		const flatRate = Number(form.liveRate || 0);
		const isFreelancer = form.memberType === "FREELANCER";

		const base = {
			memberType: form.memberType as "TEACHER" | "FREELANCER",
			teacherCode: form.teacherCode.trim(),
			fullName: form.fullName.trim(),
			roleTitle: form.roleTitle.trim() || undefined,
			email: form.email.trim() || undefined,
			mobile: form.mobile.trim() || undefined,
			specialization: form.specialization.trim() || undefined,
			bankAccountNumber: form.bankAccountNumber.trim() || undefined,
			bankIfsc: form.bankIfsc.trim() || undefined,
			bankName: form.bankName.trim() || undefined,
			panNumber: form.panNumber.trim() || undefined,
			upiId: form.upiId.trim() || undefined,
			paymentQrCodeDataUrl: form.paymentQrCodeDataUrl,
			paymentQrCodeFileName: form.paymentQrCodeFileName,
			// Freelancers use liveRate as flat rate; all other rates mirror it
			liveRate: flatRate,
			liveRateUnit: form.liveRateUnit,
			recordingRate: isFreelancer ? flatRate : Number(form.recordingRate || 0),
			recordingRateUnit: form.liveRateUnit,
			youtubeRate: isFreelancer ? flatRate : Number(form.youtubeRate || 0),
			youtubeRateUnit: form.liveRateUnit,
			doubtRate: isFreelancer ? undefined : optionalNumber(form.doubtRate),
			doubtRateUnit: form.doubtRateUnit,
			webinarRate: isFreelancer ? undefined : optionalNumber(form.webinarRate),
			webinarRateUnit: form.webinarRateUnit,
		};

		if (isEdit && teacher) {
			updateTeacher.mutate({
				id: teacher.id,
				status: form.status as TeacherRow["status"],
				...base,
				roleTitle: form.roleTitle.trim(),
				email: form.email.trim(),
				mobile: form.mobile.trim(),
				specialization: form.specialization.trim(),
				bankAccountNumber: form.bankAccountNumber.trim(),
				bankIfsc: form.bankIfsc.trim(),
				bankName: form.bankName.trim(),
				panNumber: form.panNumber.trim(),
				upiId: form.upiId.trim(),
			});
		} else {
			createTeacher.mutate(base);
		}
	};

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
				{/* Header */}
				<SheetHeader className="border-b px-6 py-4">
					<div className="flex items-center gap-4">
						{/* Avatar */}
						<div className="relative shrink-0">
							{isEdit ? (
								<>
									{avatarUrl.data?.url ? (
										<Image
											src={avatarUrl.data.url}
											alt="avatar"
											width={56}
											height={56}
											className="size-14 rounded-full object-cover ring-2 ring-border"
										/>
									) : (
										<div className="flex size-14 items-center justify-center rounded-full bg-muted ring-2 ring-border">
											<User className="size-6 text-muted-foreground" />
										</div>
									)}
									<button
										type="button"
										onClick={() => avatarInputRef.current?.click()}
										className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
										title="Change photo"
									>
										<Camera className="size-3" />
									</button>
									<input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
								</>
							) : (
								<div className="flex size-14 items-center justify-center rounded-full bg-muted ring-2 ring-border">
									<User className="size-6 text-muted-foreground" />
								</div>
							)}
						</div>

						<div className="min-w-0 flex-1">
							<SheetTitle className="text-base">
								{isEdit ? (form.fullName || "Edit member") : "Add member"}
							</SheetTitle>
							<SheetDescription className="mt-0.5 text-xs">
								{isEdit
									? "Update the member profile, payment details, and payout rules."
									: "Create a member profile with flexible payout rules and payment details."}
							</SheetDescription>
						</div>

						{form.teacherCode && (
							<Badge className="font-mono text-xs shrink-0" variant="secondary">
								{form.teacherCode}
							</Badge>
						)}
					</div>
				</SheetHeader>

				{/* Scrollable body */}
				<form
					className="flex flex-1 flex-col overflow-y-auto"
					onSubmit={handleSubmit}
				>
					<div className="flex flex-col gap-5 px-6 py-5">

						{/* Member type selector */}
						{!isEdit && (
							<div>
								<p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Member type
								</p>
								<div className="grid grid-cols-2 gap-2">
									{(["TEACHER", "FREELANCER"] as const).map((type) => (
										<button
											key={type}
											type="button"
											onClick={() => set("memberType", type)}
											className={`rounded-xl border-2 p-3 text-left transition-colors ${
												form.memberType === type
													? "border-primary bg-primary/5"
													: "border-border hover:border-muted-foreground/40"
											}`}
										>
											<p className="font-semibold text-sm">
												{type === "TEACHER" ? "Teacher / Faculty" : "Freelancer / Contractor"}
											</p>
											<p className="mt-0.5 text-xs text-muted-foreground">
												{type === "TEACHER"
													? "Per session-type rates (live, recording, YT…)"
													: "Single flat rate, any type of work"}
											</p>
										</button>
									))}
								</div>
							</div>
						)}

						{/* Identity section */}
						<div>
							<SectionHeader
								description="Basic information about the member"
								icon={User}
								title="Identity"
							/>
							<FieldGroup className="grid gap-4">
								{isEdit && (
									<FormField htmlFor="teacherCode" label="Member code">
										<Input
											className="bg-background font-mono"
											id="teacherCode"
											onChange={(e) => set("teacherCode", e.target.value)}
											placeholder="EL-001"
											required
											value={form.teacherCode}
										/>
									</FormField>
								)}

								<FormField htmlFor="fullName" label="Full name">
									<Input
										className="bg-background"
										id="fullName"
										onChange={(e) => set("fullName", e.target.value)}
										placeholder="Anjali Sharma"
										required
										value={form.fullName}
									/>
								</FormField>

								<div className="grid grid-cols-2 gap-3">
									<FormField htmlFor="roleTitle" label="Role" optional>
										<Input
											className="bg-background"
											id="roleTitle"
											onChange={(e) => set("roleTitle", e.target.value)}
											placeholder={form.memberType === "FREELANCER" ? "Video Editor" : "Physics Faculty"}
											value={form.roleTitle}
										/>
									</FormField>
									<FormField
										htmlFor="specialization"
										label={form.memberType === "FREELANCER" ? "Skills / Services" : "Specialization"}
										optional
									>
										<Input
											className="bg-background"
											id="specialization"
											onChange={(e) => set("specialization", e.target.value)}
											placeholder={form.memberType === "FREELANCER" ? "Video editing, Motion graphics" : "Physics"}
											value={form.specialization}
										/>
									</FormField>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<FormField htmlFor="email" label="Email" optional>
										<Input
											className="bg-background"
											id="email"
											onChange={(e) => set("email", e.target.value)}
											placeholder="name@org.in"
											type="email"
											value={form.email}
										/>
									</FormField>
									<FormField htmlFor="mobile" label="Mobile" optional>
										<Input
											className="bg-background"
											id="mobile"
											onChange={(e) => set("mobile", e.target.value)}
											placeholder="9876543210"
											value={form.mobile}
										/>
									</FormField>
								</div>

								{isEdit && (
									<FormField htmlFor="status" label="Status">
										<Select
											onValueChange={(value) => set("status", value)}
											value={form.status}
										>
											<SelectTrigger className="bg-background" id="status">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent>
												{TEACHER_STATUS_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FormField>
								)}
							</FieldGroup>
						</div>

						{/* Bank & Payment section */}
						<div>
							<SectionHeader
								description="For payouts and tax compliance"
								icon={Building2}
								title="Bank, tax & UPI"
							/>
							<FieldGroup className="grid gap-4">
								<div className="grid grid-cols-2 gap-3">
									<FormField htmlFor="bankAccountNumber" label="Account number" optional>
										<Input
											className="bg-background"
											id="bankAccountNumber"
											onChange={(e) => set("bankAccountNumber", e.target.value)}
											placeholder="—"
											value={form.bankAccountNumber}
										/>
									</FormField>
									<FormField htmlFor="bankIfsc" label="IFSC code" optional>
										<Input
											className="bg-background font-mono uppercase"
											id="bankIfsc"
											onChange={(e) =>
												set("bankIfsc", e.target.value.toUpperCase())
											}
											placeholder="—"
											value={form.bankIfsc}
										/>
									</FormField>
									<FormField htmlFor="bankName" label="Bank name" optional>
										<Input
											className="bg-background"
											id="bankName"
											onChange={(e) => set("bankName", e.target.value)}
											placeholder="—"
											value={form.bankName}
										/>
									</FormField>
									<FormField htmlFor="panNumber" label="PAN" optional>
										<Input
											className="bg-background font-mono uppercase"
											id="panNumber"
											onChange={(e) =>
												set("panNumber", e.target.value.toUpperCase())
											}
											placeholder="—"
											value={form.panNumber}
										/>
									</FormField>
								</div>

								{/* UPI row */}
								<div className="rounded-lg border border-dashed bg-background p-3">
									<div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
										<QrCode className="size-3.5" />
										<span>UPI — scan-and-pay from member profile</span>
									</div>
									<div className="flex gap-2">
										<Input
											className="bg-muted/40"
											id="upiId"
											onChange={(e) => set("upiId", e.target.value)}
											placeholder="name@upi"
											value={form.upiId}
										/>
										<Label
											className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
											htmlFor="paymentQrCode"
										>
											<Upload className="size-3.5" />
											Upload QR
										</Label>
										<input
											accept="image/*"
											className="hidden"
											id="paymentQrCode"
											onChange={handleQrFile}
											type="file"
										/>
										{qrUrl && (
											<Button asChild size="sm" variant="outline">
												<a href={qrUrl} rel="noreferrer" target="_blank">
													<ExternalLink className="size-3.5" />
												</a>
											</Button>
										)}
									</div>
								</div>
							</FieldGroup>
						</div>

						{/* Payout rates section */}
						<div>
							<SectionHeader
								description={
									form.memberType === "FREELANCER"
										? "Single flat rate applied to all work"
										: "Set rates for each session type"
								}
								icon={BadgeIndianRupee}
								title="Payout rate"
							/>
							{form.memberType === "FREELANCER" ? (
								<FieldGroup className="grid gap-4">
									<RateField
										form={form}
										id="liveRate"
										label="Flat rate"
										onRateChange={(value) => set("liveRate", value)}
										onUnitChange={(value) => set("liveRateUnit", value)}
										rateKey="liveRate"
										required
										unitKey="liveRateUnit"
									/>
									<p className="text-xs text-muted-foreground">
										This rate is used for all sessions regardless of type.
									</p>
								</FieldGroup>
							) : (
								<FieldGroup className="grid gap-4">
									<RateField
										form={form}
										id="liveRate"
										label="Live class"
										onRateChange={(value) => set("liveRate", value)}
										onUnitChange={(value) => set("liveRateUnit", value)}
										rateKey="liveRate"
										required
										unitKey="liveRateUnit"
									/>
									<RateField
										form={form}
										id="recordingRate"
										label="Recording"
										onRateChange={(value) => set("recordingRate", value)}
										onUnitChange={(value) => set("recordingRateUnit", value)}
										rateKey="recordingRate"
										required
										unitKey="recordingRateUnit"
									/>
									<RateField
										form={form}
										id="youtubeRate"
										label="YouTube"
										onRateChange={(value) => set("youtubeRate", value)}
										onUnitChange={(value) => set("youtubeRateUnit", value)}
										rateKey="youtubeRate"
										required
										unitKey="youtubeRateUnit"
									/>
									<div className="border-t pt-3">
										<p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
											Optional
										</p>
										<div className="grid gap-4">
											<RateField
												form={form}
												id="doubtRate"
												label="Doubt solving"
												onRateChange={(value) => set("doubtRate", value)}
												onUnitChange={(value) => set("doubtRateUnit", value)}
												rateKey="doubtRate"
												unitKey="doubtRateUnit"
											/>
											<RateField
												form={form}
												id="webinarRate"
												label="Webinar"
												onRateChange={(value) => set("webinarRate", value)}
												onUnitChange={(value) => set("webinarRateUnit", value)}
												rateKey="webinarRate"
												unitKey="webinarRateUnit"
											/>
										</div>
									</div>
								</FieldGroup>
							)}
						</div>
					</div>

					{/* Footer */}
					<SheetFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
						<div className="flex w-full items-center justify-between gap-3">
							<Button
								className="flex-1"
								disabled={isPending}
								isLoading={isPending}
								type="submit"
							>
								{isEdit ? "Save changes" : "Add member"}
							</Button>
							<Button
								className="flex-1"
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
