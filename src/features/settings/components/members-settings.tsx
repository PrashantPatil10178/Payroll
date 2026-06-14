"use client";

import { Copy, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

type Member = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
	createdAt: Date;
	isCurrentUser: boolean;
};

const ROLES = ["ORG_OWNER", "MANAGER"] as const;
type RoleVal = (typeof ROLES)[number];

const ROLE_LABELS: Record<string, string> = {
	ORG_OWNER: "Org Owner",
	MANAGER: "Manager",
	TEACHER: "Teacher",
	SUPER_ADMIN: "Super Admin",
};

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
	if (role === "ORG_OWNER") return "default";
	if (role === "MANAGER") return "secondary";
	return "outline";
}

function initials(name: string) {
	return name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

export function MembersSettings({
	members,
	currentUserRole,
}: {
	members: Member[];
	currentUserRole: string;
}) {
	const router = useRouter();
	const isOwnerOrManager = currentUserRole === "ORG_OWNER" || currentUserRole === "MANAGER";
	const isOwner = currentUserRole === "ORG_OWNER";

	// Invite dialog state
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<RoleVal>("MANAGER");
	const [generatedLink, setGeneratedLink] = useState<string | null>(null);

	const utils = api.useUtils();

	const { data: pendingInvites } = api.efms.listPendingInvites.useQuery(undefined, {
		enabled: isOwnerOrManager,
	});

	const inviteMember = api.efms.inviteMember.useMutation({
		onSuccess: (data) => {
			setGeneratedLink(data.inviteUrl);
			void utils.efms.listPendingInvites.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	const cancelInvite = api.efms.cancelInvite.useMutation({
		onSuccess: () => {
			toast.success("Invite cancelled.");
			void utils.efms.listPendingInvites.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	const updateRole = api.efms.updateMemberRole.useMutation({
		onSuccess: () => {
			toast.success("Role updated.");
			router.refresh();
		},
		onError: (err) => toast.error(err.message),
	});

	const removeMember = api.efms.removeMember.useMutation({
		onSuccess: () => {
			toast.success("Member removed.");
			router.refresh();
		},
		onError: (err) => toast.error(err.message),
	});

	const busy = updateRole.isPending || removeMember.isPending;

	const handleOpenInvite = () => {
		setInviteEmail("");
		setInviteRole("MANAGER");
		setGeneratedLink(null);
		setInviteOpen(true);
	};

	const handleSendInvite = () => {
		inviteMember.mutate({ email: inviteEmail.trim(), role: inviteRole });
	};

	const copyLink = (url: string) => {
		void navigator.clipboard.writeText(url);
		toast.success("Link copied to clipboard.");
	};

	return (
		<div className="space-y-6">
			{/* Active members */}
			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div>
						<CardTitle>Members</CardTitle>
						<CardDescription>
							{members.length} member{members.length !== 1 ? "s" : ""} in this organization.
						</CardDescription>
					</div>
					{isOwnerOrManager && (
						<Button size="sm" onClick={handleOpenInvite}>
							<UserPlus className="size-4" />
							Invite member
						</Button>
					)}
				</CardHeader>
				<CardContent className="divide-y p-0">
					{members.map((member) => (
						<div key={member.id} className="flex items-center gap-3 px-6 py-3">
							<Avatar className="size-9 shrink-0">
								<AvatarFallback className="text-xs font-medium">
									{initials(member.name)}
								</AvatarFallback>
							</Avatar>

							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<p className="truncate font-medium text-sm">{member.name}</p>
									{member.isCurrentUser && (
										<Badge variant="outline" className="text-xs">You</Badge>
									)}
								</div>
								<p className="truncate text-muted-foreground text-xs">{member.email}</p>
							</div>

							<Badge variant={roleBadgeVariant(member.role)} className="shrink-0">
								{ROLE_LABELS[member.role] ?? member.role}
							</Badge>

							{isOwner && !member.isCurrentUser && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button disabled={busy} size="sm" variant="ghost" className="size-8 p-0 shrink-0">
											<span className="sr-only">Actions</span>
											<svg className="size-4" fill="currentColor" viewBox="0 0 16 16">
												<circle cx="8" cy="3" r="1.5" />
												<circle cx="8" cy="8" r="1.5" />
												<circle cx="8" cy="13" r="1.5" />
											</svg>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-44">
										<DropdownMenuLabel className="text-xs text-muted-foreground">
											Change role
										</DropdownMenuLabel>
										{(["ORG_OWNER", "MANAGER", "TEACHER"] as const).map((role) => (
											<DropdownMenuItem
												key={role}
												disabled={member.role === role}
												onClick={() => updateRole.mutate({ userId: member.id, role })}
											>
												{ROLE_LABELS[role]}
												{member.role === role && (
													<svg className="ml-auto size-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
														<path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
													</svg>
												)}
											</DropdownMenuItem>
										))}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-destructive focus:text-destructive"
											onClick={() => {
												if (confirm(`Remove ${member.name} from the organization?`)) {
													removeMember.mutate({ userId: member.id });
												}
											}}
										>
											Remove member
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					))}
				</CardContent>
			</Card>

			{/* Pending invites */}
			{isOwnerOrManager && pendingInvites && pendingInvites.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Pending Invitations</CardTitle>
						<CardDescription>
							{pendingInvites.length} invite{pendingInvites.length !== 1 ? "s" : ""} awaiting acceptance.
						</CardDescription>
					</CardHeader>
					<CardContent className="divide-y p-0">
						{pendingInvites.map((invite) => (
							<div key={invite.id} className="flex items-center gap-3 px-6 py-3">
								<Avatar className="size-9 shrink-0">
									<AvatarFallback className="text-xs font-medium bg-muted">
										{invite.email[0]?.toUpperCase() ?? "?"}
									</AvatarFallback>
								</Avatar>

								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{invite.email}</p>
									<p className="text-muted-foreground text-xs">
										Expires {new Date(invite.expiresAt).toLocaleDateString("en-IN")}
									</p>
								</div>

								<Badge variant={roleBadgeVariant(invite.role)} className="shrink-0">
									{ROLE_LABELS[invite.role] ?? invite.role}
								</Badge>

								<Button
									size="sm"
									variant="ghost"
									className="size-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
									disabled={cancelInvite.isPending}
									onClick={() => cancelInvite.mutate({ inviteId: invite.id })}
									title="Cancel invite"
								>
									<X className="size-4" />
								</Button>
							</div>
						))}
					</CardContent>
				</Card>
			)}

			{/* Invite dialog */}
			<Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setGeneratedLink(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Invite a member</DialogTitle>
						<DialogDescription>
							Generate an invite link and share it. The link expires in 7 days.
						</DialogDescription>
					</DialogHeader>

					{!generatedLink ? (
						<div className="space-y-4 py-2">
							<div className="space-y-1.5">
								<Label htmlFor="invite-email">Email address</Label>
								<Input
									autoFocus
									id="invite-email"
									type="email"
									placeholder="colleague@example.com"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && inviteEmail.trim()) handleSendInvite();
									}}
								/>
							</div>
							<div className="space-y-1.5">
								<Label>Role</Label>
								<Select value={inviteRole} onValueChange={(v) => setInviteRole(v as RoleVal)}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="MANAGER">
											<div>
												<div className="font-medium">Manager</div>
												<div className="text-muted-foreground text-xs">Can manage teachers, sessions, payroll</div>
											</div>
										</SelectItem>
										<SelectItem value="ORG_OWNER">
											<div>
												<div className="font-medium">Org Owner</div>
												<div className="text-muted-foreground text-xs">Full access including member management</div>
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<DialogFooter className="pt-2">
								<Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
								<Button
									disabled={!inviteEmail.trim() || inviteMember.isPending}
									isLoading={inviteMember.isPending}
									onClick={handleSendInvite}
								>
									Generate invite link
								</Button>
							</DialogFooter>
						</div>
					) : (
						<div className="space-y-4 py-2">
							<p className="text-sm text-muted-foreground">
								Share this link with <strong>{inviteEmail}</strong>. They&apos;ll sign in or create
								an account and be added as <strong>{ROLE_LABELS[inviteRole]}</strong>.
							</p>
							<div className="flex gap-2">
								<Input
									readOnly
									value={generatedLink}
									className="font-mono text-xs"
								/>
								<Button
									size="icon"
									variant="outline"
									onClick={() => copyLink(generatedLink)}
									title="Copy link"
								>
									<Copy className="size-4" />
								</Button>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => { setGeneratedLink(null); setInviteEmail(""); }}
								>
									Invite another
								</Button>
								<Button onClick={() => setInviteOpen(false)}>Done</Button>
							</DialogFooter>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
