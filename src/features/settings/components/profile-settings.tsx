"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";

const ROLE_LABELS: Record<string, string> = {
	ORG_OWNER: "Org Owner",
	MANAGER: "Manager",
	TEACHER: "Teacher",
	SUPER_ADMIN: "Super Admin",
};

type Profile = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
	createdAt: Date;
};

function initials(name: string) {
	return name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

export function ProfileSettings({ profile }: { profile: Profile }) {
	const router = useRouter();
	const [name, setName] = useState(profile.name);
	const [currentPwd, setCurrentPwd] = useState("");
	const [newPwd, setNewPwd] = useState("");
	const [confirmPwd, setConfirmPwd] = useState("");
	const [pwdLoading, setPwdLoading] = useState(false);

	const updateProfile = api.efms.updateProfile.useMutation({
		onSuccess: () => {
			toast.success("Profile updated.");
			router.refresh();
		},
		onError: (err) => toast.error(err.message),
	});

	const handlePasswordChange = async () => {
		if (!currentPwd || !newPwd) {
			toast.error("Please fill in all password fields.");
			return;
		}
		if (newPwd.length < 8) {
			toast.error("New password must be at least 8 characters.");
			return;
		}
		if (newPwd !== confirmPwd) {
			toast.error("New passwords do not match.");
			return;
		}
		setPwdLoading(true);
		try {
			const result = await authClient.changePassword({
				currentPassword: currentPwd,
				newPassword: newPwd,
				revokeOtherSessions: false,
			});
			if (result.error) {
				toast.error(result.error.message ?? "Password change failed.");
			} else {
				toast.success("Password changed successfully.");
				setCurrentPwd("");
				setNewPwd("");
				setConfirmPwd("");
			}
		} catch {
			toast.error("Password change failed.");
		} finally {
			setPwdLoading(false);
		}
	};

	const nameIsDirty = name.trim() !== profile.name;

	return (
		<div className="space-y-6">
			{/* Profile card */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-4">
						<Avatar className="size-14">
							<AvatarFallback className="text-lg font-semibold">
								{initials(profile.name)}
							</AvatarFallback>
						</Avatar>
						<div>
							<CardTitle>{profile.name}</CardTitle>
							<CardDescription className="flex items-center gap-2 mt-1">
								{profile.email}
								<Badge variant="secondary">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="profile-name">Display name</Label>
						<Input
							id="profile-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
							placeholder="Your name"
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Email</Label>
						<Input value={profile.email} readOnly className="bg-muted text-muted-foreground" />
						<p className="text-muted-foreground text-xs">
							Email is managed by your auth provider and cannot be changed here.
						</p>
					</div>
				</CardContent>
				<CardFooter className="flex justify-between border-t pt-4">
					<span className="text-muted-foreground text-xs">
						Joined {new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
					</span>
					<Button
						disabled={!nameIsDirty || updateProfile.isPending}
						isLoading={updateProfile.isPending}
						onClick={() => updateProfile.mutate({ name: name.trim() })}
					>
						Save changes
					</Button>
				</CardFooter>
			</Card>

			<Separator />

			{/* Password card */}
			<Card>
				<CardHeader>
					<CardTitle>Change password</CardTitle>
					<CardDescription>Update your account password.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="current-password">Current password</Label>
						<Input
							id="current-password"
							type="password"
							value={currentPwd}
							onChange={(e) => setCurrentPwd(e.target.value)}
							autoComplete="current-password"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="new-password">New password</Label>
						<Input
							id="new-password"
							type="password"
							value={newPwd}
							onChange={(e) => setNewPwd(e.target.value)}
							autoComplete="new-password"
						/>
						<p className="text-muted-foreground text-xs">Minimum 8 characters.</p>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="confirm-password">Confirm new password</Label>
						<Input
							id="confirm-password"
							type="password"
							value={confirmPwd}
							onChange={(e) => setConfirmPwd(e.target.value)}
							autoComplete="new-password"
						/>
					</div>
				</CardContent>
				<CardFooter className="border-t pt-4">
					<Button
						disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
						isLoading={pwdLoading}
						onClick={handlePasswordChange}
					>
						Update password
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
