"use client";

import { Paperclip, Trash2 } from "lucide-react";
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
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import {
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
	remarks: string;
};

const emptyForm = (): FormState => ({
	teacherId: "",
	sessionType: "LIVE_CLASS",
	title: "",
	date: toDateInput(new Date().toISOString()),
	startTime: "",
	endTime: "",
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
		remarks: session.remarks ?? "",
	};
}

function AttachmentsSection({ sessionId, initialKeys }: { sessionId: string; initialKeys: string[] }) {
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
		<div className="grid gap-2">
			<div className="flex items-center justify-between">
				<Label>Attachments</Label>
				<button
					className="text-muted-foreground hover:text-foreground transition-colors"
					onClick={() => inputRef.current?.click()}
					type="button"
					title="Upload attachment"
				>
					<Paperclip className="size-4" />
				</button>
				<input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
			</div>
			{keys.length === 0 ? (
				<p className="text-muted-foreground text-xs">No attachments yet. Click the paperclip to upload.</p>
			) : (
				<ul className="space-y-1">
					{keys.map((key) => (
						<li key={key} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
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

	const durationMinutes = useMemo(() => {
		if (!(form.date && form.startTime && form.endTime)) {
			return null;
		}
		const start = new Date(`${form.date}T${form.startTime}`);
		const end = new Date(`${form.date}T${form.endTime}`);
		const diff = (end.getTime() - start.getTime()) / 60000;
		return Number.isFinite(diff) ? Math.round(diff) : null;
	}, [form.date, form.startTime, form.endTime]);

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
			toast.error("Select a teacher.");
			return;
		}
		if (durationMinutes === null || durationMinutes <= 0) {
			toast.error("End time must be after start time.");
			return;
		}

		const date = new Date(`${form.date}T00:00`);
		const startTime = new Date(`${form.date}T${form.startTime}`);
		const endTime = new Date(`${form.date}T${form.endTime}`);

		if (isEdit && session) {
			updateSession.mutate({
				id: session.id,
				teacherId: form.teacherId,
				sessionType: form.sessionType as SessionRow["sessionType"],
				title: form.title.trim(),
				date,
				startTime,
				endTime,
				remarks: form.remarks.trim(),
			});
		} else {
			createSession.mutate({
				teacherId: form.teacherId,
				sessionType: form.sessionType as SessionRow["sessionType"],
				title: form.title.trim(),
				date,
				startTime,
				endTime,
				remarks: form.remarks.trim() || undefined,
			});
		}
	};

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-md">
				<SheetHeader>
					<SheetTitle>{isEdit ? "Edit session" : "Record session"}</SheetTitle>
					<SheetDescription>
						Duration and payout are calculated from the teacher's rate and the
						session length.
					</SheetDescription>
				</SheetHeader>

				<form className="grid gap-4 px-4" onSubmit={handleSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="teacherId">Teacher</Label>
						<Select
							onValueChange={(value) => set("teacherId", value)}
							value={form.teacherId}
						>
							<SelectTrigger id="teacherId">
								<SelectValue placeholder="Select a teacher" />
							</SelectTrigger>
							<SelectContent>
								{teacherOptions.length === 0 ? (
									<div className="px-2 py-1.5 text-muted-foreground text-sm">
										No active teachers
									</div>
								) : (
									teacherOptions.map((teacher) => (
										<SelectItem key={teacher.id} value={teacher.id}>
											{teacher.fullName} ({teacher.teacherCode})
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="sessionType">Session type</Label>
						<Select
							onValueChange={(value) => set("sessionType", value)}
							value={form.sessionType}
						>
							<SelectTrigger id="sessionType">
								<SelectValue placeholder="Select a type" />
							</SelectTrigger>
							<SelectContent>
								{SESSION_TYPE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							onChange={(e) => set("title", e.target.value)}
							placeholder="Thermodynamics — Chapter 4"
							required
							value={form.title}
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="date">Date</Label>
						<Input
							id="date"
							onChange={(e) => set("date", e.target.value)}
							required
							type="date"
							value={form.date}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-2">
							<Label htmlFor="startTime">Start time</Label>
							<Input
								id="startTime"
								onChange={(e) => set("startTime", e.target.value)}
								required
								type="time"
								value={form.startTime}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="endTime">End time</Label>
							<Input
								id="endTime"
								onChange={(e) => set("endTime", e.target.value)}
								required
								type="time"
								value={form.endTime}
							/>
						</div>
					</div>

					{durationMinutes !== null && (
						<p className="text-muted-foreground text-sm">
							Duration:{" "}
							<span
								className={
									durationMinutes > 0 ? "font-medium text-foreground" : "text-destructive"
								}
							>
								{durationMinutes > 0
									? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m (${durationMinutes} min)`
									: "End time must be after start time"}
							</span>
						</p>
					)}

					<div className="grid gap-2">
						<Label htmlFor="remarks">Remarks</Label>
						<Textarea
							id="remarks"
							onChange={(e) => set("remarks", e.target.value)}
							placeholder="Optional notes"
							value={form.remarks}
						/>
					</div>

					{/* Attachments — only available when editing an existing session */}
					{isEdit && session && (
						<AttachmentsSection sessionId={session.id} initialKeys={session.attachments ?? []} />
					)}

					<SheetFooter className="px-0">
						<Button disabled={isPending} isLoading={isPending} type="submit">
							{isEdit ? "Save changes" : "Record session"}
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
