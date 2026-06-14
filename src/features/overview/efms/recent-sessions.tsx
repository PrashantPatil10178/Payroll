import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type Session = {
	title: string;
	teacherName: string;
	sessionType: string;
	date: Date;
	durationMinutes: number;
	amount: number;
};

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

function typeLabel(t: string) {
	return t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");
}

export function RecentSessions({
	sessions,
	month,
}: {
	sessions: Session[];
	month: string;
}) {
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Recent Sessions</CardTitle>
				<CardDescription>
					{sessions.length === 0
						? `No sessions in ${month}.`
						: `Latest ${sessions.length} sessions — ${month}`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{sessions.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						No sessions recorded this month yet.
					</p>
				) : (
					<div className="space-y-4">
						{sessions.map((s, i) => (
							<div key={i} className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-medium text-sm leading-none">
										{s.title}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{s.teacherName} ·{" "}
										{new Date(s.date).toLocaleDateString("en-IN", {
											day: "numeric",
											month: "short",
										})}
									</p>
								</div>
								<div className="flex shrink-0 flex-col items-end gap-1">
									<span className="font-medium text-sm tabular-nums">
										{currency.format(s.amount)}
									</span>
									<Badge className="text-xs" variant="outline">
										{typeLabel(s.sessionType)}
									</Badge>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
