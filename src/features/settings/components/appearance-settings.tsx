"use client";

import { ThemeModeToggle } from "@/components/themes/theme-mode-toggle";
import { ThemeSelector } from "@/components/themes/theme-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function AppearanceSettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>Customize the look and feel of the dashboard.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="font-medium text-sm">Color theme</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								Choose a color palette for the dashboard.
							</p>
						</div>
						<ThemeSelector />
					</div>
					<Separator />
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="font-medium text-sm">Light / Dark mode</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								Toggle between light and dark mode.
							</p>
						</div>
						<ThemeModeToggle />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
