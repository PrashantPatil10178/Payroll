import { MembersSettings } from "@/features/settings/components/members-settings";
import { api } from "@/trpc/server";

export const metadata = { title: "Settings: Members" };

export default async function MembersSettingsPage() {
	const [members, profile] = await Promise.all([
		api.efms.listMembers(),
		api.efms.getProfile(),
	]);

	return (
		<MembersSettings
			members={members}
			currentUserRole={profile.role}
		/>
	);
}
