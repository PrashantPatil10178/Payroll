import "@/styles/globals.css";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ActiveThemeProvider } from "@/components/themes/active-theme";
import ThemeProvider from "@/components/themes/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
	title: "EasyLearning Faculty Management System",
	description: "Multi-tenant faculty operations and payroll for EasyLearning.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const cookieStore = await cookies();
	const activeThemeValue = cookieStore.get("active_theme")?.value;

	return (
		<html
			lang="en"
			suppressHydrationWarning
			{...(activeThemeValue ? { "data-theme": activeThemeValue } : {})}
		>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<ActiveThemeProvider initialTheme={activeThemeValue}>
						<NuqsAdapter>
							<TRPCReactProvider>{children}</TRPCReactProvider>
						</NuqsAdapter>
						<Toaster />
					</ActiveThemeProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
