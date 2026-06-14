import { db } from "@/server/db";
import { Role } from "../../../../generated/prisma";

export async function ensureUserTenant(userId: string) {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, organizationId: true, role: true },
	});

	if (!user) throw new Error("User not found.");

	if (user.organizationId) {
		// Ensure the UserOrganization row exists (backfill for existing users)
		await db.userOrganization.upsert({
			where: { userId_organizationId: { userId: user.id, organizationId: user.organizationId } },
			create: { userId: user.id, organizationId: user.organizationId, role: user.role },
			update: {},
		});
		return user;
	}

	// First sign-in — provision a personal organization
	const org = await db.organization.create({
		data: {
			name: `${user.name ?? "My"}'s Organization`,
			slug: `org-${user.id.slice(0, 10).toLowerCase()}`,
			ownerId: userId,
		},
	});

	await db.userOrganization.create({
		data: { userId: user.id, organizationId: org.id, role: Role.ORG_OWNER },
	});

	return db.user.update({
		where: { id: user.id },
		data: { organizationId: org.id, role: Role.ORG_OWNER },
		select: { id: true, name: true, organizationId: true, role: true },
	});
}
