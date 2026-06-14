import { NextResponse } from "next/server";
import { auth } from "@/server/better-auth";
import { db } from "@/server/db";
import { Role } from "../../../../../generated/prisma";

export async function POST(req: Request) {
	const body = await req.json() as { token: string; name: string; email: string; password: string };
	const { token, name, email, password } = body;

	if (!token || !name || !email || !password) {
		return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
	}

	// Validate invite token
	const teacher = await db.teacher.findUnique({
		where: { inviteToken: token },
	});

	if (!teacher || !teacher.inviteExpiresAt) {
		return NextResponse.json({ error: "Invalid invite link." }, { status: 400 });
	}

	if (new Date() > teacher.inviteExpiresAt) {
		return NextResponse.json({ error: "Invite link has expired." }, { status: 400 });
	}

	if (teacher.userId) {
		return NextResponse.json({ error: "Invite already accepted." }, { status: 400 });
	}

	// Check if email already exists
	const existing = await db.user.findUnique({ where: { email } });
	if (existing) {
		return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 400 });
	}

	// Create user via better-auth internal API
	const signUpRes = await auth.api.signUpEmail({
		body: { name, email, password },
	});

	if (!signUpRes?.user?.id) {
		return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
	}

	const userId = signUpRes.user.id;

	// Link user to teacher + set org
	await db.$transaction([
		db.teacher.update({
			where: { id: teacher.id },
			data: {
				userId,
				inviteToken: null,
				inviteExpiresAt: null,
			},
		}),
		db.user.update({
			where: { id: userId },
			data: { organizationId: teacher.organizationId, role: Role.TEACHER },
		}),
		db.userOrganization.upsert({
			where: { userId_organizationId: { userId, organizationId: teacher.organizationId } },
			create: { userId, organizationId: teacher.organizationId, role: Role.TEACHER },
			update: {},
		}),
	]);

	return NextResponse.json({ ok: true });
}
