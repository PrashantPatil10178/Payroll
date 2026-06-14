import type { ReactNode } from "react";

import { InfoButton } from "@/components/ui/info-button";
import type { InfobarContent } from "@/components/ui/infobar";

function PageSkeleton() {
	return (
		<div className="flex flex-1 animate-pulse flex-col gap-4 p-4 md:px-6">
			<div className="flex items-center justify-between">
				<div>
					<div className="mb-2 h-8 w-48 rounded bg-muted" />
					<div className="h-4 w-96 rounded bg-muted" />
				</div>
			</div>
			<div className="mt-6 h-40 w-full rounded-lg bg-muted" />
			<div className="h-40 w-full rounded-lg bg-muted" />
		</div>
	);
}

export default function PageContainer({
	access = true,
	accessFallback,
	children,
	infoContent,
	isLoading = false,
	pageDescription,
	pageHeaderAction,
	pageTitle,
}: {
	access?: boolean;
	accessFallback?: ReactNode;
	children: ReactNode;
	infoContent?: InfobarContent;
	isLoading?: boolean;
	pageDescription?: string;
	pageHeaderAction?: ReactNode;
	pageTitle?: string;
}) {
	if (!access) {
		return (
			<div className="flex flex-1 items-center justify-center p-4 md:px-6">
				{accessFallback ?? (
					<div className="text-center text-lg text-muted-foreground">
						You do not have access to this page.
					</div>
				)}
			</div>
		);
	}

	const content = isLoading ? <PageSkeleton /> : children;
	const hasHeader = pageTitle || pageHeaderAction;

	return (
		<div className="flex flex-1 flex-col px-4 pt-2 pb-4 md:px-6 md:pt-4">
			{hasHeader && (
				<div className="mb-4 flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<h1 className="font-bold text-2xl tracking-tight">{pageTitle}</h1>
							{infoContent && (
								<div className="pt-1">
									<InfoButton content={infoContent} />
								</div>
							)}
						</div>
						{pageDescription && (
							<p className="text-muted-foreground">{pageDescription}</p>
						)}
					</div>
					{pageHeaderAction && (
						<div className="shrink-0">{pageHeaderAction}</div>
					)}
				</div>
			)}
			{content}
		</div>
	);
}
