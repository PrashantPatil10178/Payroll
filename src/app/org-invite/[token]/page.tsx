import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { getSession } from "@/server/better-auth/server";
import { OrgInviteAcceptForm } from "./org-invite-accept-form";

export const metadata = { title: "Accept Invitation" };

export default async function OrgInvitePage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;

	const invite = await db.orgInvite.findUnique({
		where: { token },
		include: { organization: { select: { name: true } } },
	});

	if (!invite) {
		return <InviteMessage title="Invalid link" description="This invitation link is invalid or has already been used." />;
	}
	if (invite.acceptedAt) {
		return <InviteMessage title="Already accepted" description="This invitation has already been accepted." />;
	}
	if (invite.expiresAt < new Date()) {
		return <InviteMessage title="Link expired" description="This invitation has expired. Ask your admin to send a new one." />;
	}

	// If the user is already signed in, accept on their behalf directly
	const session = await getSession();
	if (session?.user?.id) {
		redirect(`/api/org-invite/accept?token=${token}&redirect=1`);
	}

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
			<div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
				<div className="space-y-1 text-center">
					<h1 className="text-2xl font-bold tracking-tight">You&apos;re invited</h1>
					<p className="text-muted-foreground text-sm">
						Join <strong>{invite.organization.name}</strong> as{" "}
						<strong>{invite.role === "ORG_OWNER" ? "Org Owner" : "Manager"}</strong>.
					</p>
				</div>
				<OrgInviteAcceptForm
					token={token}
					prefillEmail={invite.email}
					orgName={invite.organization.name}
				/>
			</div>
		</div>
	);
}

function InviteMessage({ title, description }: { title: string; description: string }) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
			<h1 className="text-xl font-semibold">{title}</h1>
			<p className="text-muted-foreground text-sm max-w-xs">{description}</p>
		</div>
	);
}
