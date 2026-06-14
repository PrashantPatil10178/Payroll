import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { getSession } from "@/server/better-auth/server";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const token = searchParams.get("token");
	const shouldRedirect = searchParams.get("redirect") === "1";

	if (!token) {
		return NextResponse.json({ error: "Missing token." }, { status: 400 });
	}

	const session = await getSession();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
	}

	const invite = await db.orgInvite.findUnique({ where: { token } });

	if (!invite) {
		return NextResponse.json({ error: "Invalid invitation." }, { status: 404 });
	}
	if (invite.acceptedAt) {
		// Already accepted — just land on dashboard if redirected
		if (shouldRedirect) redirect("/dashboard");
		return NextResponse.json({ error: "Invitation already accepted." }, { status: 409 });
	}
	if (invite.expiresAt < new Date()) {
		if (shouldRedirect) redirect("/dashboard?error=invite_expired");
		return NextResponse.json({ error: "Invitation has expired." }, { status: 410 });
	}

	// Accept
	await db.$transaction([
		// Mark invite accepted
		db.orgInvite.update({
			where: { id: invite.id },
			data: { acceptedAt: new Date() },
		}),
		// Add/update membership
		db.userOrganization.upsert({
			where: {
				userId_organizationId: {
					userId: session.user.id,
					organizationId: invite.organizationId,
				},
			},
			create: {
				userId: session.user.id,
				organizationId: invite.organizationId,
				role: invite.role,
			},
			update: { role: invite.role },
		}),
		// Switch user's active org
		db.user.update({
			where: { id: session.user.id },
			data: { organizationId: invite.organizationId, role: invite.role },
		}),
	]);

	if (shouldRedirect) redirect("/dashboard");
	return NextResponse.json({ ok: true });
}
