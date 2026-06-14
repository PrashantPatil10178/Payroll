"use client";

import { useEffect, useState } from "react";
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
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/trpc/react";
import { type TeacherRow, TEACHER_STATUS_OPTIONS } from "../types";

type FormState = {
	teacherCode: string;
	fullName: string;
	email: string;
	mobile: string;
	specialization: string;
	status: string;
	bankAccountNumber: string;
	bankIfsc: string;
	bankName: string;
	panNumber: string;
	liveRate: string;
	recordingRate: string;
	youtubeRate: string;
	doubtRate: string;
	webinarRate: string;
};

const EMPTY: FormState = {
	teacherCode: "",
	fullName: "",
	email: "",
	mobile: "",
	specialization: "",
	status: "ACTIVE",
	bankAccountNumber: "",
	bankIfsc: "",
	bankName: "",
	panNumber: "",
	liveRate: "",
	recordingRate: "",
	youtubeRate: "",
	doubtRate: "",
	webinarRate: "",
};

function fromTeacher(teacher: TeacherRow): FormState {
	return {
		teacherCode: teacher.teacherCode,
		fullName: teacher.fullName,
		email: teacher.email ?? "",
		mobile: teacher.mobile ?? "",
		specialization: teacher.specialization ?? "",
		status: teacher.status,
		bankAccountNumber: teacher.bankAccountNumber ?? "",
		bankIfsc: teacher.bankIfsc ?? "",
		bankName: teacher.bankName ?? "",
		panNumber: teacher.panNumber ?? "",
		liveRate: teacher.rates ? String(teacher.rates.liveRate) : "",
		recordingRate: teacher.rates ? String(teacher.rates.recordingRate) : "",
		youtubeRate: teacher.rates ? String(teacher.rates.youtubeRate) : "",
		doubtRate: teacher.rates?.doubtRate != null ? String(teacher.rates.doubtRate) : "",
		webinarRate:
			teacher.rates?.webinarRate != null ? String(teacher.rates.webinarRate) : "",
	};
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

	useEffect(() => {
		if (open) {
			setForm(teacher ? fromTeacher(teacher) : EMPTY);
		}
	}, [open, teacher]);

	const handleSuccess = (message: string) => {
		toast.success(message);
		onOpenChange(false);
		onSaved();
	};

	const createTeacher = api.efms.createTeacher.useMutation({
		onSuccess: () => handleSuccess("Teacher added."),
		onError: (error) => toast.error(error.message),
	});
	const updateTeacher = api.efms.updateTeacher.useMutation({
		onSuccess: () => handleSuccess("Teacher updated."),
		onError: (error) => toast.error(error.message),
	});

	const isPending = createTeacher.isPending || updateTeacher.isPending;

	const set = (key: keyof FormState, value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const optionalNumber = (value: string) =>
		value.trim() === "" ? undefined : Number(value);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();

		const base = {
			teacherCode: form.teacherCode.trim(),
			fullName: form.fullName.trim(),
			email: form.email.trim() || undefined,
			mobile: form.mobile.trim() || undefined,
			specialization: form.specialization.trim() || undefined,
			bankAccountNumber: form.bankAccountNumber.trim() || undefined,
			bankIfsc: form.bankIfsc.trim() || undefined,
			bankName: form.bankName.trim() || undefined,
			panNumber: form.panNumber.trim() || undefined,
			liveRate: Number(form.liveRate || 0),
			recordingRate: Number(form.recordingRate || 0),
			youtubeRate: Number(form.youtubeRate || 0),
			doubtRate: optionalNumber(form.doubtRate),
			webinarRate: optionalNumber(form.webinarRate),
		};

		if (isEdit && teacher) {
			updateTeacher.mutate({
				id: teacher.id,
				status: form.status as TeacherRow["status"],
				...base,
				email: form.email.trim(),
				mobile: form.mobile.trim(),
				specialization: form.specialization.trim(),
				bankAccountNumber: form.bankAccountNumber.trim(),
				bankIfsc: form.bankIfsc.trim(),
				bankName: form.bankName.trim(),
				panNumber: form.panNumber.trim(),
			});
		} else {
			createTeacher.mutate(base);
		}
	};

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-md">
				<SheetHeader>
					<SheetTitle>{isEdit ? "Edit teacher" : "Add teacher"}</SheetTitle>
					<SheetDescription>
						{isEdit
							? "Update the teacher's profile and payout rates."
							: "Create a faculty profile and set their per-hour payout rates."}
					</SheetDescription>
				</SheetHeader>

				<form className="grid gap-4 px-4" onSubmit={handleSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="teacherCode">Teacher code</Label>
						<Input
							id="teacherCode"
							onChange={(e) => set("teacherCode", e.target.value)}
							placeholder="EL-001"
							required
							value={form.teacherCode}
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="fullName">Full name</Label>
						<Input
							id="fullName"
							onChange={(e) => set("fullName", e.target.value)}
							placeholder="Anjali Sharma"
							required
							value={form.fullName}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								onChange={(e) => set("email", e.target.value)}
								placeholder="teacher@easylearning.in"
								type="email"
								value={form.email}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="mobile">Mobile</Label>
							<Input
								id="mobile"
								onChange={(e) => set("mobile", e.target.value)}
								placeholder="9876543210"
								value={form.mobile}
							/>
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="specialization">Specialization</Label>
						<Input
							id="specialization"
							onChange={(e) => set("specialization", e.target.value)}
							placeholder="Physics"
							value={form.specialization}
						/>
					</div>

					{isEdit && (
						<div className="grid gap-2">
							<Label htmlFor="status">Status</Label>
							<Select
								onValueChange={(value) => set("status", value)}
								value={form.status}
							>
								<SelectTrigger id="status">
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
						</div>
					)}

					<div className="mt-2 border-t pt-4">
						<p className="mb-3 font-medium text-sm">Bank & tax details</p>
						<div className="grid gap-3">
							<div className="grid grid-cols-2 gap-3">
								<div className="grid gap-2">
									<Label htmlFor="bankAccountNumber">Account number</Label>
									<Input
										id="bankAccountNumber"
										onChange={(e) => set("bankAccountNumber", e.target.value)}
										placeholder="optional"
										value={form.bankAccountNumber}
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="bankIfsc">IFSC</Label>
									<Input
										id="bankIfsc"
										onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())}
										placeholder="optional"
										value={form.bankIfsc}
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="bankName">Bank name</Label>
									<Input
										id="bankName"
										onChange={(e) => set("bankName", e.target.value)}
										placeholder="optional"
										value={form.bankName}
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="panNumber">PAN</Label>
									<Input
										id="panNumber"
										onChange={(e) => set("panNumber", e.target.value.toUpperCase())}
										placeholder="optional"
										value={form.panNumber}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-2 border-t pt-4">
						<p className="mb-3 font-medium text-sm">Payout rates (per hour)</p>
						<div className="grid grid-cols-2 gap-3">
							<div className="grid gap-2">
								<Label htmlFor="liveRate">Live class</Label>
								<Input
									id="liveRate"
									min={0}
									onChange={(e) => set("liveRate", e.target.value)}
									required
									step="0.01"
									type="number"
									value={form.liveRate}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="recordingRate">Recording</Label>
								<Input
									id="recordingRate"
									min={0}
									onChange={(e) => set("recordingRate", e.target.value)}
									required
									step="0.01"
									type="number"
									value={form.recordingRate}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="youtubeRate">YouTube</Label>
								<Input
									id="youtubeRate"
									min={0}
									onChange={(e) => set("youtubeRate", e.target.value)}
									required
									step="0.01"
									type="number"
									value={form.youtubeRate}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="doubtRate">Doubt solving</Label>
								<Input
									id="doubtRate"
									min={0}
									onChange={(e) => set("doubtRate", e.target.value)}
									placeholder="optional"
									step="0.01"
									type="number"
									value={form.doubtRate}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="webinarRate">Webinar</Label>
								<Input
									id="webinarRate"
									min={0}
									onChange={(e) => set("webinarRate", e.target.value)}
									placeholder="optional"
									step="0.01"
									type="number"
									value={form.webinarRate}
								/>
							</div>
						</div>
					</div>

					<SheetFooter className="px-0">
						<Button disabled={isPending} isLoading={isPending} type="submit">
							{isEdit ? "Save changes" : "Add teacher"}
						</Button>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
