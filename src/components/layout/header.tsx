import { Breadcrumbs } from "../breadcrumbs";
import SearchInput from "../search-input";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";
import { ThemeModeToggle } from "../themes/theme-mode-toggle";
import { ThemeSelector } from "../themes/theme-selector";
import { NotificationCenter } from "@/features/notifications/components/notification-center";

export default function Header() {
	return (
		<header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 bg-background/60 backdrop-blur-md md:h-14">
			<div className="flex items-center gap-2 px-4">
				<SidebarTrigger className="-ml-1" />
				<Separator className="mr-2 h-4" orientation="vertical" />
				<Breadcrumbs />
			</div>

			<div className="flex items-center gap-2 px-4">
				<div className="hidden md:flex">
					<SearchInput />
				</div>
				<ThemeModeToggle />
				<div className="hidden sm:block">
					<ThemeSelector />
				</div>
				<NotificationCenter />
			</div>
		</header>
	);
}
