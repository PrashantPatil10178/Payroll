"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
	{ label: "General", href: "/dashboard/settings/general" },
	{ label: "Members", href: "/dashboard/settings/members" },
	{ label: "Profile", href: "/dashboard/settings/profile" },
];

export function SettingsNav() {
	const pathname = usePathname();

	return (
		<nav className="flex shrink-0 flex-row gap-1 md:w-44 md:flex-col">
			{NAV.map((item) => {
				const active = pathname === item.href;
				return (
					<Link
						key={item.href}
						href={item.href}
						className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
							active
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
