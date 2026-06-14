import type * as React from "react";

import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"relative flex size-8 shrink-0 overflow-hidden rounded-full",
				className,
			)}
			data-slot="avatar"
			{...props}
		/>
	);
}

function AvatarImage({
	alt = "",
	className,
	src,
	...props
}: React.ComponentProps<"img">) {
	// Don't render an <img> with an empty src — let AvatarFallback show instead.
	if (!src) {
		return null;
	}
	return (
		// biome-ignore lint/a11y/useAltText: alt is provided/forwarded via props
		<img
			alt={alt}
			className={cn("aspect-square size-full object-cover", className)}
			data-slot="avatar-image"
			src={src}
			{...props}
		/>
	);
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex size-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs",
				className,
			)}
			data-slot="avatar-fallback"
			{...props}
		/>
	);
}

export { Avatar, AvatarFallback, AvatarImage };
