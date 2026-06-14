import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import { InfoSidebar } from "@/components/layout/info-sidebar";
import { InfobarProvider } from "@/components/ui/infobar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db } from "@/server/db";
import { getSession } from "@/server/better-auth/server";
import { ensureUserTenant } from "@/server/services/organizations/ensure-user-tenant";

export const metadata: Metadata = {
	title: "EasyLearning Faculty Management System",
	description: "Multi-tenant faculty operations and payroll for EasyLearning.",
	robots: {
		index: false,
		follow: false,
	},
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();

	if (!session?.user?.id) {
		redirect("/sign-in");
	}

	const user = await ensureUserTenant(session.user.id);
	const organization = user.organizationId
		? await db.organization.findUnique({
				where: { id: user.organizationId },
				select: { name: true },
			})
		: null;

	// Persisting the sidebar state in the cookie.
	const cookieStore = await cookies();
	const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

	return (
		<KBar>
			<SidebarProvider defaultOpen={defaultOpen}>
				<AppSidebar
					organizationName={organization?.name ?? "EasyLearning"}
					role={user.role}
					user={{
						name: session.user.name,
						email: session.user.email,
						image: session.user.image,
					}}
				/>
				<SidebarInset>
					<Header />
					<InfobarProvider defaultOpen={false}>
						{children}
						<InfoSidebar side="right" />
					</InfobarProvider>
				</SidebarInset>
			</SidebarProvider>
		</KBar>
	);
}
