import { cn } from "@/lib/utils";
import { InteractiveGridPattern } from "./interactive-grid";

export function AuthLeftPanel() {
	return (
		<div className="relative hidden h-full flex-col p-10 lg:flex dark:border-r">
			<div className="absolute inset-0 bg-sidebar" />

			{/* Logo */}
			<div className="relative z-20 flex items-center gap-2 text-lg font-semibold text-sidebar-foreground">
				<div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="size-4"
					>
						<path d="M22 10v6M2 10l10-5 10 5-10 5z" />
						<path d="M6 12v5c3 3 9 3 12 0v-5" />
					</svg>
				</div>
				EasyLearning EFMS
			</div>

			{/* Interactive grid */}
			<InteractiveGridPattern
				className={cn(
					"mask-[radial-gradient(400px_circle_at_center,white,transparent)]",
					"inset-x-0 inset-y-[0%] h-full skew-y-12",
				)}
			/>

			{/* Testimonial */}
			<div className="relative z-20 mt-auto">
				<blockquote className="space-y-2">
					<p className="text-lg text-sidebar-foreground">
						&ldquo;EFMS streamlined our entire faculty management process — from
						recording sessions to generating payroll in a single click. An
						absolute game-changer for our institute.&rdquo;
					</p>
					<footer className="text-sm text-sidebar-foreground/70">
						Prashant — EasyLearning Admin
					</footer>
				</blockquote>
			</div>
		</div>
	);
}
