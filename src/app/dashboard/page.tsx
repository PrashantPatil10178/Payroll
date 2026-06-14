import { redirect } from "next/navigation";

import { getSession } from "@/server/better-auth/server";

export default async function Dashboard() {
	const session = await getSession();

	if (!session?.user?.id) {
		redirect("/sign-in");
	}

	redirect("/dashboard/overview");
}
