import { NextResponse } from "next/server";

import { getSession } from "@/server/better-auth/server";
import { ensureUserTenant } from "@/server/services/organizations/ensure-user-tenant";

export async function POST() {
	const session = await getSession();

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	await ensureUserTenant(session.user.id);

	return NextResponse.json({ ok: true });
}
