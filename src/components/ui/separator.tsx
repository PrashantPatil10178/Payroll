import type * as React from "react";

import { cn } from "@/lib/utils";

function Separator({
	className,
	orientation = "horizontal",
	...props
}: React.ComponentProps<"hr"> & {
	orientation?: "horizontal" | "vertical";
}) {
	return (
		<hr
			aria-orientation={orientation}
			className={cn(
				"shrink-0 bg-border",
				orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
				className,
			)}
			data-slot="separator"
			{...props}
		/>
	);
}

export { Separator };
