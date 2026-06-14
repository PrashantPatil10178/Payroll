import { notFound } from "next/navigation";

import { db } from "@/server/db";
import { InviteAcceptForm } from "./invite-accept-form";

export const metadata = { title: "Accept Invitation — EasyLearning EFMS" };

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
	const { token } = await params;

	const teacher = await db.teacher.findUnique({
		where: { inviteToken: token },
		include: { organization: { select: { name: true } } },
	});

	if (!teacher || !teacher.inviteExpiresAt) return notFound();
	if (new Date() > teacher.inviteExpiresAt) {
		return (
			<main className="grid min-h-screen place-items-center p-6">
				<div className="w-full max-w-sm space-y-3 text-center">
					<h1 className="text-2xl font-semibold">Invite expired</h1>
					<p className="text-muted-foreground text-sm">
						This invite link has expired. Ask your administrator to generate a new one.
					</p>
				</div>
			</main>
		);
	}

	if (teacher.userId) {
		return (
			<main className="grid min-h-screen place-items-center p-6">
				<div className="w-full max-w-sm space-y-3 text-center">
					<h1 className="text-2xl font-semibold">Already accepted</h1>
					<p className="text-muted-foreground text-sm">
						This invite has already been accepted. You can{" "}
						<a href="/sign-in" className="text-primary underline underline-offset-4">
							sign in
						</a>
						.
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className="grid min-h-screen place-items-center p-6">
			<InviteAcceptForm
				token={token}
				teacherName={teacher.fullName}
				orgName={teacher.organization.name}
				prefillEmail={teacher.inviteEmail ?? teacher.email ?? ""}
			/>
		</main>
	);
}
