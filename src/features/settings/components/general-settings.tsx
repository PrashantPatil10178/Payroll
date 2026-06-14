"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";

type OrgSettings = {
	id: string;
	name: string;
	slug: string;
	status: string;
	createdAt: Date;
	userCount: number;
	teacherCount: number;
};

export function GeneralSettings({ org }: { org: OrgSettings }) {
	const [name, setName] = useState(org.name);

	const update = api.efms.updateOrgSettings.useMutation({
		onSuccess: (data) => {
			toast.success(`Organization name updated to "${data.name}".`);
		},
		onError: (err) => toast.error(err.message),
	});

	const isDirty = name.trim() !== org.name;

	return (
		<div className="space-y-6">
			{/* Org info card */}
			<Card>
				<CardHeader>
					<CardTitle>Organization</CardTitle>
					<CardDescription>General information about your organization.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="org-name">Organization name</Label>
						<Input
							id="org-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
							placeholder="Organization name"
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Slug</Label>
						<Input value={org.slug} readOnly className="bg-muted text-muted-foreground" />
						<p className="text-muted-foreground text-xs">Slug is set on creation and cannot be changed.</p>
					</div>
				</CardContent>
				<CardFooter className="flex items-center justify-between border-t pt-4">
					<div className="flex items-center gap-2">
						<Badge variant={org.status === "ACTIVE" ? "default" : "destructive"}>
							{org.status.toLowerCase()}
						</Badge>
						<span className="text-muted-foreground text-xs">
							Created {new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
						</span>
					</div>
					<Button
						disabled={!isDirty || update.isPending}
						isLoading={update.isPending}
						onClick={() => update.mutate({ name: name.trim() })}
					>
						Save changes
					</Button>
				</CardFooter>
			</Card>

			<Separator />

			{/* Stats card */}
			<Card>
				<CardHeader>
					<CardTitle>Overview</CardTitle>
					<CardDescription>Quick stats for this organization.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						<StatBox label="Members" value={org.userCount} />
						<StatBox label="Teachers" value={org.teacherCount} />
						<StatBox label="Status" value={org.status.toLowerCase()} />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function StatBox({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg border bg-muted/40 p-4">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 font-semibold text-xl tabular-nums capitalize">{value}</p>
		</div>
	);
}
