"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/server/better-auth/client";

const DEMO = { email: "demo@easylearning.in", password: "Demo@12345" };

export function SignInView() {
	const router = useRouter();
	const [email, setEmail] = useState(DEMO.email);
	const [password, setPassword] = useState(DEMO.password);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [githubPending, setGithubPending] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setPending(true);
		try {
			const res = await authClient.signIn.email({ email, password });
			if (res.error) {
				setError(res.error.message ?? "Invalid credentials.");
				return;
			}
			router.push("/dashboard");
			router.refresh();
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setPending(false);
		}
	};

	const handleGithub = async () => {
		setGithubPending(true);
		try {
			await authClient.signIn.social({ provider: "github", callbackURL: "/dashboard" });
		} catch {
			toast.error("GitHub sign-in failed.");
			setGithubPending(false);
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
			{/* Header */}
			<div className="flex flex-col space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
				<p className="text-muted-foreground text-sm">
					Sign in to manage teachers, sessions and payroll.
				</p>
			</div>

			{/* GitHub */}
			<Button
				disabled={githubPending}
				onClick={handleGithub}
				type="button"
				variant="outline"
				className="w-full"
			>
				{githubPending ? (
					<Icons.spinner className="mr-2 size-4 animate-spin" />
				) : (
					<Icons.github className="mr-2 size-4" />
				)}
				Continue with GitHub
			</Button>

			<div className="relative">
				<div className="absolute inset-0 flex items-center">
					<Separator />
				</div>
				<div className="relative flex justify-center text-xs uppercase">
					<span className="bg-background px-2 text-muted-foreground">or continue with email</span>
				</div>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="you@easylearning.in"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoComplete="email"
					/>
				</div>
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<Label htmlFor="password">Password</Label>
					</div>
					<Input
						id="password"
						type="password"
						placeholder="••••••••"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
					/>
				</div>

				{error && (
					<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
						{error}
					</p>
				)}

				<Button disabled={pending} type="submit" className="w-full">
					{pending && <Icons.spinner className="mr-2 size-4 animate-spin" />}
					Sign in
				</Button>
			</form>

			{/* Demo credentials */}
			<div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
				<p className="font-medium text-foreground">Demo credentials</p>
				<p className="mt-1 text-muted-foreground">
					{DEMO.email} / {DEMO.password}
				</p>
			</div>

			<p className="text-center text-muted-foreground text-sm">
				Don&apos;t have an account?{" "}
				<Link href="/sign-up" className="font-medium text-primary hover:underline underline-offset-4">
					Sign up
				</Link>
			</p>

			<p className="px-4 text-center text-muted-foreground text-xs">
				By continuing, you agree to our{" "}
				<Link href="/terms-of-service" className="underline underline-offset-4 hover:text-primary">
					Terms of Service
				</Link>{" "}
				and{" "}
				<Link href="/privacy-policy" className="underline underline-offset-4 hover:text-primary">
					Privacy Policy
				</Link>
				.
			</p>
		</div>
	);
}
