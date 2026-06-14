import { GeneralSettings } from "@/features/settings/components/general-settings";
import { api } from "@/trpc/server";

export const metadata = { title: "Settings: General" };

export default async function GeneralSettingsPage() {
	const org = await api.efms.getOrgSettings();
	return <GeneralSettings org={org} />;
}
