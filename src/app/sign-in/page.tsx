import { redirect } from "next/navigation";

import { AuthLeftPanel } from "@/features/auth/components/auth-left-panel";
import { SignInView } from "@/features/auth/components/sign-in-view";
import { getSession } from "@/server/better-auth/server";

export const metadata = { title: "Sign In — EasyLearning EFMS" };

export default async function SignInPage() {
	const session = await getSession();
	if (session?.user) redirect("/dashboard");

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
			<AuthLeftPanel />
			<div className="flex h-full min-h-screen items-center justify-center p-6 lg:p-10">
				<SignInView />
			</div>
		</div>
	);
}
