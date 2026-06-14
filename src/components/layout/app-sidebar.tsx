"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Icons } from "@/components/icons";
import { OrgSwitcher } from "@/components/org-switcher";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import {
	type AvatarUser,
	UserAvatarProfile,
} from "@/components/user-avatar-profile";
import { navGroups } from "@/config/nav-config";
import { useFilteredNavGroups } from "@/hooks/use-nav";
import type { NavGroup } from "@/types";
import { authClient } from "@/server/better-auth/client";

const teacherNavGroups: NavGroup[] = [
	{
		label: "My Portal",
		items: [
			{ title: "My Sessions", url: "/dashboard/my-sessions", icon: "calendar", isActive: false, items: [] },
			{ title: "My Payslips", url: "/dashboard/my-payslips", icon: "billing", isActive: false, items: [] },
			{ title: "Profile", url: "/dashboard/settings/profile", icon: "profile", isActive: false, items: [] },
		],
	},
];

export default function AppSidebar({
	organizationName,
	user,
	role,
}: {
	organizationName: string;
	user: AvatarUser | null;
	role?: string;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const sourceGroups = role === "TEACHER" ? teacherNavGroups : navGroups;
	const filteredGroups = useFilteredNavGroups(sourceGroups);

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/sign-in");
		router.refresh();
	};

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="group-data-[collapsible=icon]:pt-4">
				<OrgSwitcher organizationName={organizationName} />
			</SidebarHeader>
			<SidebarContent className="overflow-x-hidden">
				{filteredGroups.map((group) => (
					<SidebarGroup className="py-0" key={group.label || "ungrouped"}>
						{group.label && (
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						)}
						<SidebarMenu>
							{group.items.map((item) => {
								const Icon = item.icon ? Icons[item.icon] : Icons.logo;
								return item?.items && item?.items?.length > 0 ? (
									<Collapsible
										asChild
										className="group/collapsible"
										defaultOpen={item.isActive}
										key={item.title}
									>
										<SidebarMenuItem>
											<CollapsibleTrigger asChild>
												<SidebarMenuButton
													isActive={pathname === item.url}
													tooltip={item.title}
												>
													{item.icon && <Icon />}
													<span>{item.title}</span>
													<Icons.chevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
												</SidebarMenuButton>
											</CollapsibleTrigger>
											<CollapsibleContent>
												<SidebarMenuSub>
													{item.items?.map((subItem) => (
														<SidebarMenuSubItem key={subItem.title}>
															<SidebarMenuSubButton
																asChild
																isActive={pathname === subItem.url}
															>
																<Link href={subItem.url}>
																	<span>{subItem.title}</span>
																</Link>
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>
													))}
												</SidebarMenuSub>
											</CollapsibleContent>
										</SidebarMenuItem>
									</Collapsible>
								) : (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={pathname === item.url}
											tooltip={item.title}
										>
											<Link href={item.url}>
												<Icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
									size="lg"
								>
									{user && (
										<UserAvatarProfile
											className="h-8 w-8 rounded-lg"
											showInfo
											user={user}
										/>
									)}
									<Icons.chevronsDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
								side="bottom"
								sideOffset={4}
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="px-1 py-1.5">
										{user && (
											<UserAvatarProfile
												className="h-8 w-8 rounded-lg"
												showInfo
												user={user}
											/>
										)}
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuItem
										onClick={() => router.push("/dashboard/notifications")}
									>
										<Icons.notification className="mr-2 h-4 w-4" />
										Notifications
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleSignOut}>
									<Icons.logout className="mr-2 h-4 w-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
