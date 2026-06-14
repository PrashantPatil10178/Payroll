"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { api } from "@/trpc/react";

function initials(name: string) {
	return name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

export function OrgSwitcher({
	organizationName,
}: {
	organizationName: string;
}) {
	const { isMobile, state } = useSidebar();
	const router = useRouter();
	const [createOpen, setCreateOpen] = useState(false);
	const [newOrgName, setNewOrgName] = useState("");
	const [switchingTo, setSwitchingTo] = useState<string | null>(null);

	const utils = api.useUtils();

	const { data: orgs } = api.efms.listMyOrganizations.useQuery(undefined, {
		staleTime: 0, // always fresh so active flag is correct after switch
	});

	const switchOrg = api.efms.switchOrganization.useMutation({
		onMutate: (vars) => {
			setSwitchingTo(vars.organizationId);
		},
		onSuccess: async (_, vars) => {
			// 1. Optimistically mark the new org as active in the cache
			utils.efms.listMyOrganizations.setData(undefined, (prev) =>
				prev?.map((o) => ({ ...o, isActive: o.id === vars.organizationId })),
			);
			// 2. Invalidate all tenant-scoped queries so stale data from the old
			//    org is not shown after the switch
			await utils.efms.invalidate();
			// 3. Navigate to dashboard root so no stale route-level data lingers
			router.push("/dashboard");
			router.refresh();
		},
		onError: (err) => {
			setSwitchingTo(null);
			toast.error(err.message);
		},
		onSettled: () => {
			setSwitchingTo(null);
		},
	});

	const createOrg = api.efms.createOrganization.useMutation({
		onSuccess: async (org) => {
			toast.success(`"${org.name}" created and activated.`);
			setCreateOpen(false);
			setNewOrgName("");
			// Refetch orgs list so new org appears, then navigate
			await utils.efms.listMyOrganizations.invalidate();
			await utils.efms.invalidate();
			router.push("/dashboard");
			router.refresh();
		},
		onError: (err) => toast.error(err.message),
	});

	const activeOrg = orgs?.find((o) => o.isActive);
	const displayName = activeOrg?.name ?? organizationName;

	return (
		<>
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								size="lg"
							>
								<div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs">
									{switchingTo ? (
										<Icons.spinner className="size-4 animate-spin" />
									) : (
										initials(displayName)
									)}
								</div>
								<div
									className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
										state === "collapsed"
											? "invisible max-w-0 overflow-hidden opacity-0"
											: "visible max-w-full opacity-100"
									}`}
								>
									<span className="truncate font-medium">{displayName}</span>
									<span className="truncate text-muted-foreground text-xs">
										{orgs && orgs.length > 1
											? `${orgs.length} organizations`
											: "Organization"}
									</span>
								</div>
								<Icons.chevronsUpDown
									className={`ml-auto size-4 transition-all duration-200 ease-in-out ${
										state === "collapsed"
											? "invisible max-w-0 opacity-0"
											: "visible max-w-full opacity-100"
									}`}
								/>
							</SidebarMenuButton>
						</DropdownMenuTrigger>

						<DropdownMenuContent
							align="start"
							className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
							side={isMobile ? "bottom" : "right"}
							sideOffset={4}
						>
							<DropdownMenuLabel className="text-muted-foreground text-xs">
								My Organizations
							</DropdownMenuLabel>

							{!orgs ? (
								<div className="flex items-center gap-2 px-2 py-2 text-muted-foreground text-sm">
									<Icons.spinner className="size-3 animate-spin" />
									Loading…
								</div>
							) : orgs.length === 0 ? (
								<div className="px-2 py-2 text-muted-foreground text-sm">
									No organizations found.
								</div>
							) : (
								orgs.map((org) => {
									const isSwitching = switchingTo === org.id;
									return (
										<DropdownMenuItem
											key={org.id}
											className="gap-2 p-2"
											disabled={org.isActive || switchOrg.isPending}
											onClick={() => {
												if (!org.isActive && !switchOrg.isPending) {
													switchOrg.mutate({ organizationId: org.id });
												}
											}}
										>
											<div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs">
												{isSwitching ? (
													<Icons.spinner className="size-3 animate-spin" />
												) : (
													initials(org.name)
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="truncate font-medium">{org.name}</div>
												<div className="text-muted-foreground text-xs capitalize">
													{org.role.toLowerCase().replace(/_/g, " ")}
												</div>
											</div>
											{org.isActive && !isSwitching && (
												<Icons.check className="size-4 shrink-0 text-primary" />
											)}
										</DropdownMenuItem>
									);
								})
							)}

							<DropdownMenuSeparator />

							<DropdownMenuItem
								className="gap-2 p-2"
								onClick={() => setCreateOpen(true)}
							>
								<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
									<Icons.add className="size-4" />
								</div>
								<span className="font-medium text-muted-foreground">
									Create organization
								</span>
							</DropdownMenuItem>

							<DropdownMenuItem
								className="gap-2 p-2"
								onClick={() => router.push("/dashboard/settings/general")}
							>
								<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
									<Icons.settings className="size-3.5" />
								</div>
								<span className="font-medium text-muted-foreground">
									Organization settings
								</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>

			{/* Create org dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Create organization</DialogTitle>
						<DialogDescription>
							Each organization is fully isolated — its own teachers, sessions, and payroll.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<Label htmlFor="new-org-name">Organization name</Label>
						<Input
							autoFocus
							id="new-org-name"
							value={newOrgName}
							onChange={(e) => setNewOrgName(e.target.value)}
							placeholder="e.g. EasyLearning Pune"
							maxLength={100}
							onKeyDown={(e) => {
								if (e.key === "Enter" && newOrgName.trim().length >= 2) {
									createOrg.mutate({ name: newOrgName.trim() });
								}
							}}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={newOrgName.trim().length < 2 || createOrg.isPending}
							isLoading={createOrg.isPending}
							onClick={() => createOrg.mutate({ name: newOrgName.trim() })}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
