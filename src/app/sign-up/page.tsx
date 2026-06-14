import { redirect } from "next/navigation";

import { AuthLeftPanel } from "@/features/auth/components/auth-left-panel";
import { SignUpView } from "@/features/auth/components/sign-up-view";
import { getSession } from "@/server/better-auth/server";

export const metadata = { title: "Sign Up — EasyLearning EFMS" };

export default async function SignUpPage() {
	const session = await getSession();
	if (session?.user) redirect("/dashboard");

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
			<AuthLeftPanel />
			<div className="flex h-full min-h-screen items-center justify-center p-6 lg:p-10">
				<SignUpView />
			</div>
		</div>
	);
}
