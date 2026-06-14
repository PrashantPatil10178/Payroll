import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import PageContainer from "@/components/layout/page-container";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { getSession } from "@/server/better-auth/server";

export const metadata = { title: "Settings" };

export default async function SettingsLayout({ children }: { children: ReactNode }) {
	const session = await getSession();
	if (!session?.user) redirect("/sign-in");

	return (
		<PageContainer pageTitle="Settings" pageDescription="Manage your organization and account.">
			<div className="flex flex-col gap-6 md:flex-row">
				<SettingsNav />
				<div className="min-w-0 flex-1">{children}</div>
			</div>
		</PageContainer>
	);
}
