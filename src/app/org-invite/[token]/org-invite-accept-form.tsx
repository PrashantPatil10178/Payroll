"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/server/better-auth/client";

type Mode = "signin" | "signup";

export function OrgInviteAcceptForm({
	token,
	prefillEmail,
	orgName,
}: {
	token: string;
	prefillEmail: string;
	orgName: string;
}) {
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("signin");
	const [name, setName] = useState("");
	const [email, setEmail] = useState(prefillEmail);
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			if (mode === "signup") {
				if (password !== confirmPassword) {
					setError("Passwords do not match.");
					setLoading(false);
					return;
				}
				// Create account first
				const res = await authClient.signUp.email({ name, email, password });
				if (res.error) {
					setError(res.error.message ?? "Sign up failed.");
					setLoading(false);
					return;
				}
			} else {
				// Sign in
				const res = await authClient.signIn.email({ email, password });
				if (res.error) {
					setError(res.error.message ?? "Sign in failed.");
					setLoading(false);
					return;
				}
			}

			// Now call the accept API
			const acceptRes = await fetch(`/api/org-invite/accept?token=${token}`);
			if (!acceptRes.ok) {
				const body = (await acceptRes.json()) as { error?: string };
				setError(body.error ?? "Failed to accept invitation.");
				setLoading(false);
				return;
			}

			toast.success(`Welcome to ${orgName}!`);
			router.push("/dashboard");
			router.refresh();
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{mode === "signup" && (
				<div className="space-y-1.5">
					<Label htmlFor="name">Full name</Label>
					<Input
						id="name"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Jane Doe"
					/>
				</div>
			)}

			<div className="space-y-1.5">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder={mode === "signup" ? "Create a password" : "Your password"}
				/>
			</div>

			{mode === "signup" && (
				<div className="space-y-1.5">
					<Label htmlFor="confirmPassword">Confirm password</Label>
					<Input
						id="confirmPassword"
						type="password"
						required
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						placeholder="Repeat password"
					/>
				</div>
			)}

			{error && (
				<p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">{error}</p>
			)}

			<Button type="submit" className="w-full" disabled={loading} isLoading={loading}>
				{mode === "signup" ? "Create account & join" : "Sign in & join"}
			</Button>

			<p className="text-center text-muted-foreground text-sm">
				{mode === "signin" ? (
					<>
						Don&apos;t have an account?{" "}
						<button type="button" className="underline" onClick={() => setMode("signup")}>
							Create one
						</button>
					</>
				) : (
					<>
						Already have an account?{" "}
						<button type="button" className="underline" onClick={() => setMode("signin")}>
							Sign in instead
						</button>
					</>
				)}
			</p>
		</form>
	);
}
