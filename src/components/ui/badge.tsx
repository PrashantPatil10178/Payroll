import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs transition-colors [&>svg]:size-3",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"border-transparent bg-destructive text-white hover:bg-destructive/90",
				outline: "border-border bg-background text-foreground",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
			},
		},
	},
);

function Badge({
	className,
	variant,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			className={cn(badgeVariants({ className, variant }))}
			data-slot="badge"
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
