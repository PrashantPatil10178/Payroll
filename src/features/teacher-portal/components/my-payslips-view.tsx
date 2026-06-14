"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import { MONTHS } from "@/features/payroll/types";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

type Payslip = {
	id: string;
	month: number;
	year: number;
	status: string;
	totalAmount: number;
	liveAmount: number;
	recordingAmount: number;
	youtubeAmount: number;
	otherAmount: number;
	bonusAmount: number;
	deductionAmount: number;
	tdsAmount: number;
	netAmount: number;
	paymentMethod: string | null;
	paymentReference: string | null;
	sessionCount: number;
	totalMinutes: number;
	paidAt: Date | null;
	payslipKey: string | null;
};

type Profile = { fullName: string; organization: { name: string } };

function StatusBadge({ status }: { status: string }) {
	const variant = status === "PAID" ? "default" : status === "GENERATED" ? "secondary" : "outline";
	return <Badge variant={variant}>{status.toLowerCase()}</Badge>;
}

function DownloadButton({ payrollId }: { payrollId: string }) {
	const [loading, setLoading] = useState(false);
	const getUrl = api.efms.getPayslipDownloadUrl.useQuery({ payrollId }, { enabled: false });

	const handleDownload = async () => {
		setLoading(true);
		try {
			const res = await getUrl.refetch();
			if (res.data?.url) {
				window.open(res.data.url, "_blank");
			} else {
				toast.error("Payslip PDF not available yet.");
			}
		} catch {
			toast.error("Failed to get download link.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button disabled={loading} onClick={handleDownload} size="sm" variant="outline">
			<Download className="size-4" />
			PDF
		</Button>
	);
}

export function MyPayslipsView({ profile, payslips }: { profile: Profile; payslips: Payslip[] }) {
	const totalPaid = payslips
		.filter((p) => p.status === "PAID")
		.reduce((acc, p) => acc + p.netAmount, 0);

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total payslips</CardDescription>
						<CardTitle className="text-2xl tabular-nums">{payslips.length}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total paid out</CardDescription>
						<CardTitle className="text-2xl tabular-nums">{currency.format(totalPaid)}</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{payslips.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
					<p className="text-muted-foreground text-sm">
						No payslips generated yet. Your administrator will generate them after the month ends.
					</p>
				</div>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Period</TableHead>
								<TableHead className="text-right">Sessions</TableHead>
								<TableHead className="text-right">Hours</TableHead>
								<TableHead className="text-right">Live</TableHead>
								<TableHead className="text-right">Recording</TableHead>
								<TableHead className="text-right">Net pay</TableHead>
								<TableHead>Status</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{payslips.map((p) => (
								<TableRow key={p.id}>
									<TableCell className="font-medium">
										{MONTHS[p.month - 1]} {p.year}
									</TableCell>
									<TableCell className="text-right tabular-nums">{p.sessionCount}</TableCell>
									<TableCell className="text-right tabular-nums">
										{Math.floor(p.totalMinutes / 60)}h {p.totalMinutes % 60}m
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{p.liveAmount > 0 ? currency.format(p.liveAmount) : "—"}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{p.recordingAmount > 0 ? currency.format(p.recordingAmount) : "—"}
									</TableCell>
									<TableCell className="text-right font-semibold tabular-nums">
										{currency.format(p.netAmount)}
										{p.netAmount !== p.totalAmount && (
											<span className="block text-muted-foreground text-xs font-normal">
												gross {currency.format(p.totalAmount)}
											</span>
										)}
									</TableCell>
									<TableCell>
										<div className="flex flex-col gap-0.5">
											<StatusBadge status={p.status} />
											{p.paidAt && (
												<span className="text-muted-foreground text-xs">
													{new Date(p.paidAt).toLocaleDateString("en-IN")}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										{p.payslipKey && <DownloadButton payrollId={p.id} />}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
