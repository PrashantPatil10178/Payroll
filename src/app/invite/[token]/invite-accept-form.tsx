"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function InviteAcceptForm({
	token,
	teacherName,
	orgName,
	prefillEmail,
}: {
	token: string;
	teacherName: string;
	orgName: string;
	prefillEmail: string;
}) {
	const router = useRouter();
	const [name, setName] = useState(teacherName);
	const [email, setEmail] = useState(prefillEmail);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (password !== confirm) { setError("Passwords do not match."); return; }
		if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
		setPending(true);
		try {
			const res = await fetch("/api/invite/accept", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, name, email, password }),
			});
			const data = await res.json() as { error?: string };
			if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
			router.push("/dashboard");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setPending(false);
		}
	};

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>You&apos;re invited!</CardTitle>
				<CardDescription>
					You&apos;ve been invited to join <strong>{orgName}</strong> as a teacher. Set up your
					account to access your sessions and payslips.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="name">Full name</Label>
						<Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="password">Password</Label>
						<Input id="password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="confirm">Confirm password</Label>
						<Input id="confirm" type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
					</div>
					{error && (
						<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
							{error}
						</p>
					)}
					<Button disabled={pending} type="submit" className="w-full">
						{pending ? "Creating account…" : "Accept invitation"}
					</Button>
				</form>
			</CardContent>
			<CardFooter className="justify-center text-muted-foreground text-sm">
				Already have an account?{" "}
				<Link href="/sign-in" className="ml-1 font-medium text-primary hover:underline underline-offset-4">
					Sign in
				</Link>
			</CardFooter>
		</Card>
	);
}
