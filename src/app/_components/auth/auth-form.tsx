"use client";

import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { authClient } from "@/server/better-auth/client";

const demoCredentials = {
	email: "demo@easylearning.in",
	password: "Demo@12345",
};

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: AuthMode }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	const isSignUp = mode === "sign-up";

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<div className="mb-2 flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<GraduationCap className="size-5" />
					</div>
					<Badge variant="secondary">EasyLearning EFMS</Badge>
				</div>
				<CardTitle className="text-3xl tracking-tight">
					{isSignUp ? "Create your account" : "Welcome back"}
				</CardTitle>
				<CardDescription>
					{isSignUp
						? "Start a tenant-isolated EasyLearning workspace."
						: "Sign in to manage teachers, sessions, payroll, and reports."}
				</CardDescription>
			</CardHeader>

			<CardContent>
				<form
					className="grid gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						setError(null);
						setIsPending(true);

						const formData = new FormData(event.currentTarget);
						const email = String(formData.get("email") ?? "");
						const password = String(formData.get("password") ?? "");
						const name = String(formData.get("name") ?? "");

						try {
							const response = isSignUp
								? await authClient.signUp.email({
										email,
										name,
										password,
									})
								: await authClient.signIn.email({
										email,
										password,
									});

							if (response.error) {
								setError(response.error.message ?? "Authentication failed.");
								return;
							}

							if (isSignUp) {
								await fetch("/api/onboarding/complete", {
									method: "POST",
								});
							}

							router.push("/dashboard");
							router.refresh();
						} catch {
							setError("Something went wrong. Please try again.");
						} finally {
							setIsPending(false);
						}
					}}
				>
					{isSignUp && (
						<label className="grid gap-2" htmlFor="name">
							<span className="font-medium text-sm">Full name</span>
							<Input
								id="name"
								name="name"
								placeholder="Prashant"
								required
								type="text"
							/>
						</label>
					)}

					<label className="grid gap-2" htmlFor="email">
						<span className="font-medium text-sm">Email</span>
						<Input
							defaultValue={isSignUp ? "" : demoCredentials.email}
							id="email"
							name="email"
							placeholder="you@easylearning.in"
							required
							type="email"
						/>
					</label>

					<label className="grid gap-2" htmlFor="password">
						<span className="font-medium text-sm">Password</span>
						<Input
							defaultValue={isSignUp ? "" : demoCredentials.password}
							id="password"
							minLength={8}
							name="password"
							placeholder="Minimum 8 characters"
							required
							type="password"
						/>
					</label>

					{error && (
						<p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
							{error}
						</p>
					)}

					<Button disabled={isPending} type="submit">
						{isPending
							? "Please wait..."
							: isSignUp
								? "Create account"
								: "Sign in"}
					</Button>
				</form>

				<div className="mt-5 rounded-md bg-muted p-3 text-muted-foreground text-sm">
					<p className="font-semibold text-foreground">Demo credentials</p>
					<p>Email: {demoCredentials.email}</p>
					<p>Password: {demoCredentials.password}</p>
				</div>
			</CardContent>

			<CardFooter className="justify-center text-muted-foreground text-sm">
				{isSignUp ? "Already have an account?" : "Need an account?"}{" "}
				<Link
					className="ml-1 font-semibold text-primary hover:underline"
					href={isSignUp ? "/sign-in" : "/sign-up"}
				>
					{isSignUp ? "Sign in" : "Sign up"}
				</Link>
			</CardFooter>
		</Card>
	);
}

export { demoCredentials };
