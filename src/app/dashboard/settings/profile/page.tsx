import { ProfileSettings } from "@/features/settings/components/profile-settings";
import { api } from "@/trpc/server";

export const metadata = { title: "Settings: Profile" };

export default async function ProfileSettingsPage() {
	const profile = await api.efms.getProfile();
	return <ProfileSettings profile={profile} />;
}
