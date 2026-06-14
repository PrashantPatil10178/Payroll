"use client";

import { Archive, Copy, ImagePlus, Mail, Pencil, Plus, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import { TeacherFormSheet } from "./teacher-form-sheet";
import type { TeacherRow } from "../types";

function AvatarUploadButton({ teacherId, avatarKey }: { teacherId: string; avatarKey: string | null }) {
	const inputRef = useRef<HTMLInputElement>(null);
	const upload = api.efms.uploadTeacherAvatar.useMutation();
	const { data: avatarData } = api.efms.getTeacherAvatarUrl.useQuery(
		{ teacherId },
		{ enabled: !!avatarKey, staleTime: 1000 * 60 * 60 },
	);
	const router = useRouter();

	const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			upload.mutate({ teacherId, dataUrl }, {
				onSuccess: () => { toast.success("Avatar uploaded."); router.refresh(); },
				onError: (err) => toast.error(err.message),
			});
		};
		reader.readAsDataURL(file);
	};

	return (
		<div className="relative inline-block">
			{avatarData?.url ? (
				<Image
					src={avatarData.url}
					alt="avatar"
					width={32}
					height={32}
					className="size-8 rounded-full object-cover ring-1 ring-border"
				/>
			) : (
				<div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<ImagePlus className="size-4" />
				</div>
			)}
			<button
				className="absolute inset-0 rounded-full opacity-0 hover:opacity-60 hover:bg-black/40 transition-opacity flex items-center justify-center cursor-pointer"
				onClick={() => inputRef.current?.click()}
				title="Upload avatar"
				type="button"
			>
				<ImagePlus className="size-3 text-white" />
			</button>
			<input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
		</div>
	);
}

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

function StatusBadge({ status }: { status: TeacherRow["status"] }) {
	const variant =
		status === "ACTIVE"
			? "default"
			: status === "INACTIVE"
				? "secondary"
				: "outline";
	return <Badge variant={variant}>{status.toLowerCase()}</Badge>;
}

export function TeachersView({ teachers }: { teachers: TeacherRow[] }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<TeacherRow | null>(null);
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [inviteTeacherName, setInviteTeacherName] = useState("");

	const archiveTeacher = api.efms.archiveTeacher.useMutation({
		onSuccess: () => {
			toast.success("Teacher status updated.");
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const generateInvite = api.efms.generateTeacherInvite.useMutation({
		onSuccess: (data) => {
			setInviteUrl(data.inviteUrl);
		},
		onError: (err) => toast.error(err.message),
	});

	const openCreate = () => {
		setEditing(null);
		setOpen(true);
	};
	const openEdit = (teacher: TeacherRow) => {
		setEditing(teacher);
		setOpen(true);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{teachers.length} teacher{teachers.length === 1 ? "" : "s"}
				</p>
				<Button onClick={openCreate}>
					<Plus className="size-4" />
					Add Teacher
				</Button>
			</div>

			{teachers.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-10 text-center">
					<p className="font-medium">No teachers yet</p>
					<p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
						Add your first faculty member with their per-hour payout rates to
						start recording sessions.
					</p>
					<Button className="mt-4" onClick={openCreate} variant="outline">
						<Plus className="size-4" />
						Add Teacher
					</Button>
				</div>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-10" />
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Contact</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Live</TableHead>
								<TableHead className="text-right">Recording</TableHead>
								<TableHead className="text-right">YouTube</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{teachers.map((teacher) => {
								const isArchived = teacher.status === "ARCHIVED";
								return (
									<TableRow key={teacher.id}>
										<TableCell>
											<AvatarUploadButton teacherId={teacher.id} avatarKey={teacher.avatarKey} />
										</TableCell>
										<TableCell className="font-mono text-xs">
											{teacher.teacherCode}
										</TableCell>
										<TableCell>
											<div className="font-medium">{teacher.fullName}</div>
											{teacher.specialization && (
												<div className="text-muted-foreground text-xs">
													{teacher.specialization}
												</div>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{teacher.email && <div>{teacher.email}</div>}
											{teacher.mobile && <div>{teacher.mobile}</div>}
											{!teacher.email && !teacher.mobile && "—"}
										</TableCell>
										<TableCell>
											<StatusBadge status={teacher.status} />
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{teacher.rates ? currency.format(teacher.rates.liveRate) : "—"}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{teacher.rates
												? currency.format(teacher.rates.recordingRate)
												: "—"}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{teacher.rates
												? currency.format(teacher.rates.youtubeRate)
												: "—"}
										</TableCell>
										<TableCell>
											<div className="flex items-center justify-end gap-1">
												{teacher.hasPortalAccess && (
													<Badge variant="outline" className="px-1.5 text-xs">Portal</Badge>
												)}
												<Button onClick={() => openEdit(teacher)} size="sm" variant="ghost">
													<Pencil className="size-4" />
													<span className="sr-only">Edit</span>
												</Button>
												{!teacher.hasPortalAccess && !isArchived && (
													<Button
														disabled={generateInvite.isPending}
														onClick={() => {
															setInviteTeacherName(teacher.fullName);
															generateInvite.mutate({ teacherId: teacher.id });
														}}
														size="sm"
														variant="ghost"
														title="Invite to portal"
													>
														<Mail className="size-4" />
														<span className="sr-only">Invite</span>
													</Button>
												)}
												<Button
													disabled={archiveTeacher.isPending}
													onClick={() =>
														archiveTeacher.mutate({
															id: teacher.id,
															status: isArchived ? "ACTIVE" : "ARCHIVED",
														})
													}
													size="sm"
													variant="ghost"
												>
													{isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
													<span className="sr-only">{isArchived ? "Restore" : "Archive"}</span>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			<TeacherFormSheet
				onOpenChange={setOpen}
				onSaved={() => router.refresh()}
				open={open}
				teacher={editing}
			/>

			{/* Invite link dialog */}
			<Dialog open={!!inviteUrl} onOpenChange={(o) => !o && setInviteUrl(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Invite link generated</DialogTitle>
						<DialogDescription>
							Share this link with <strong>{inviteTeacherName}</strong>. It expires in 7 days.
							They&apos;ll set a password and get access to their portal.
						</DialogDescription>
					</DialogHeader>
					<div className="flex gap-2 pt-2">
						<Input readOnly value={inviteUrl ?? ""} className="font-mono text-xs" />
						<Button
							size="icon"
							variant="outline"
							onClick={() => {
								if (inviteUrl) {
									void navigator.clipboard.writeText(inviteUrl);
									toast.success("Copied to clipboard.");
								}
							}}
						>
							<Copy className="size-4" />
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
