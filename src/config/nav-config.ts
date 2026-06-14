import type { NavGroup } from "@/types";

/**
 * Navigation configuration for the sidebar and Cmd+K bar.
 *
 * Pruned to the pages that exist in this app (reference demo pages tied to
 * Clerk org/billing/profile were removed during the better-auth migration).
 */
export const navGroups: NavGroup[] = [
	{
		label: "EFMS",
		items: [
			{
				title: "Dashboard",
				url: "/dashboard/overview",
				icon: "dashboard",
				isActive: false,
				shortcut: ["d", "d"],
				items: [],
			},
			{
				title: "Teachers",
				url: "/dashboard/teachers",
				icon: "employee",
				isActive: false,
				shortcut: ["t", "t"],
				items: [],
			},
			{
				title: "Sessions",
				url: "/dashboard/sessions",
				icon: "calendar",
				isActive: false,
				shortcut: ["s", "s"],
				items: [],
			},
			{
				title: "Payroll",
				url: "/dashboard/payroll",
				icon: "billing",
				isActive: false,
				shortcut: ["p", "p"],
				items: [],
			},
			{
				title: "Reports",
				url: "/dashboard/reports",
				icon: "forms",
				isActive: false,
				shortcut: ["r", "r"],
				items: [
					{ title: "Teacher Report", url: "/dashboard/reports/teacher", icon: "employee" },
					{ title: "Finance Report", url: "/dashboard/reports/finance", icon: "billing" },
					{ title: "Activity Report", url: "/dashboard/reports/activity", icon: "dashboard" },
				],
			},
			{
				title: "Settings",
				url: "/dashboard/settings",
				icon: "settings",
				isActive: false,
				shortcut: ["g", "g"],
				items: [
					{ title: "General", url: "/dashboard/settings/general", icon: "settings" },
					{ title: "Members", url: "/dashboard/settings/members", icon: "teams" },
					{ title: "Profile", url: "/dashboard/settings/profile", icon: "profile" },
				],
			},
		],
	},
];
