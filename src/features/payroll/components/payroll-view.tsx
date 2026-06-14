"use client";

import {
	CheckCircle2,
	MoreHorizontal,
	Pencil,
	RefreshCw,
	RotateCcw,
	Wallet,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import {
	MONTHS,
	PAYMENT_METHODS,
	type PayrollRow,
	type PersistedPayroll,
	paymentMethodLabel,
} from "../types";

const currency = new Intl.NumberFormat("en-IN", {
	currency: "INR",
	maximumFractionDigits: 0,
	style: "currency",
});

type PaymentMethodVal = (typeof PAYMENT_METHODS)[number]["value"];

function StatusCell({ payroll }: { payroll: PayrollRow["payroll"] }) {
	if (!payroll) {
		return <span className="text-muted-foreground text-sm">Not generated</span>;
	}
	const variant =
		payroll.status === "PAID"
			? "default"
			: payroll.status === "GENERATED"
				? "secondary"
				: payroll.status === "CANCELLED"
					? "destructive"
					: "outline";
	return (
		<div className="flex flex-col gap-0.5">
			<Badge variant={variant}>{payroll.status.toLowerCase()}</Badge>
			{payroll.status === "PAID" && payroll.paymentMethod && (
				<span className="text-muted-foreground text-xs">
					{paymentMethodLabel(payroll.paymentMethod)}
					{payroll.paidAt && ` · ${new Date(payroll.paidAt).toLocaleDateString("en-IN")}`}
				</span>
			)}
		</div>
	);
}

export function PayrollView({
	month,
	rows,
	year,
}: {
	month: number;
	year: number;
	rows: PayrollRow[];
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Dialog state
	const [payDialog, setPayDialog] = useState<{ row: PayrollRow } | null>(null);
	const [adjustDialog, setAdjustDialog] = useState<{ row: PayrollRow } | null>(null);

	const generate = api.efms.generatePayroll.useMutation({
		onSuccess: (result) => {
			toast.success(
				`Generated ${result.generated} payroll${result.generated === 1 ? "" : "s"}` +
					(result.skippedPaid > 0 ? ` (${result.skippedPaid} paid skipped)` : "."),
			);
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const setStatus = api.efms.setPayrollStatus.useMutation({
		onSuccess: () => {
			toast.success("Payroll status updated.");
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const recalculate = api.efms.recalculatePayroll.useMutation({
		onSuccess: () => {
			toast.success("Payroll recalculated from approved sessions.");
			router.refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	const setPeriod = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set(key, value);
		router.push(`${pathname}?${params.toString()}`);
	};

	const years = Array.from({ length: 4 }, (_, i) => year - 2 + i);

	const totals = rows.reduce(
		(acc, row) => {
			const net = row.payroll ? row.payroll.net : row.computedAmount;
			acc.payable += net;
			if (row.payroll?.status === "PAID") {
				acc.paid += net;
			}
			if (row.payroll) {
				acc.generated += 1;
			}
			return acc;
		},
		{ payable: 0, paid: 0, generated: 0 },
	);

	const busy =
		generate.isPending || setStatus.isPending || recalculate.isPending;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Select onValueChange={(v) => setPeriod("month", v)} value={String(month)}>
						<SelectTrigger className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{MONTHS.map((label, index) => (
								<SelectItem key={label} value={String(index + 1)}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select onValueChange={(v) => setPeriod("year", v)} value={String(year)}>
						<SelectTrigger className="w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{years.map((y) => (
								<SelectItem key={y} value={String(y)}>
									{y}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button
					disabled={busy || rows.length === 0}
					isLoading={generate.isPending}
					onClick={() => generate.mutate({ month, year })}
				>
					<Wallet className="size-4" />
					Generate payroll
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<SummaryCard label="Teachers" value={String(rows.length)} />
				<SummaryCard label="Net payable" value={currency.format(totals.payable)} />
				<SummaryCard label="Generated" value={String(totals.generated)} />
				<SummaryCard label="Paid out" value={currency.format(totals.paid)} />
			</div>

			{rows.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/50 p-10 text-center">
					<p className="font-medium">No payroll data for this month</p>
					<p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
						Record and approve sessions for {MONTHS[month - 1]} {year}, then generate
						payroll to compute each teacher's payout.
					</p>
				</div>
			) : (
				<div className="rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Teacher</TableHead>
								<TableHead className="text-right">Sessions</TableHead>
								<TableHead className="text-right">Gross</TableHead>
								<TableHead className="text-right">Bonus</TableHead>
								<TableHead className="text-right">Deduction</TableHead>
								<TableHead className="text-right">TDS</TableHead>
								<TableHead className="text-right font-semibold">Net</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Action</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const p = row.payroll;
								const gross = p ? p.totalAmount : row.computedAmount;
								const net = p ? p.net : row.computedAmount;
								return (
									<TableRow key={row.teacherId}>
										<TableCell className="font-medium">{row.teacherName}</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.sessionCount}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{currency.format(gross)}
										</TableCell>
										<TableCell className="text-right tabular-nums text-emerald-600">
											{p && p.bonus > 0 ? `+${currency.format(p.bonus)}` : "—"}
										</TableCell>
										<TableCell className="text-right tabular-nums text-destructive">
											{p && p.deduction > 0 ? `−${currency.format(p.deduction)}` : "—"}
										</TableCell>
										<TableCell className="text-right tabular-nums text-destructive">
											{p && p.tds > 0 ? `−${currency.format(p.tds)}` : "—"}
										</TableCell>
										<TableCell className="text-right font-semibold tabular-nums">
											{currency.format(net)}
										</TableCell>
										<TableCell>
											<StatusCell payroll={p} />
										</TableCell>
										<TableCell className="text-right">
											{!p ? (
												<span className="text-muted-foreground text-xs">pending</span>
											) : (
												<div className="flex items-center justify-end gap-1">
													{p.status !== "PAID" && (
														<Button
															disabled={busy}
															onClick={() => setPayDialog({ row })}
															size="sm"
															variant="outline"
														>
															<CheckCircle2 className="size-4" />
															Mark paid
														</Button>
													)}
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																disabled={busy}
																size="sm"
																variant="ghost"
																className="size-8 p-0"
															>
																<MoreHorizontal className="size-4" />
																<span className="sr-only">More</span>
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-48">
															<DropdownMenuItem
																disabled={p.status === "PAID"}
																onClick={() => setAdjustDialog({ row })}
															>
																<Pencil className="mr-2 size-4" />
																Adjustments
															</DropdownMenuItem>
															<DropdownMenuItem
																disabled={p.status === "PAID"}
																onClick={() => recalculate.mutate({ id: p.id })}
															>
																<RefreshCw className="mr-2 size-4" />
																Recalculate
															</DropdownMenuItem>
															{p.status === "PAID" && (
																<>
																	<DropdownMenuSeparator />
																	<DropdownMenuItem
																		onClick={() =>
																			setStatus.mutate({ id: p.id, status: "GENERATED" })
																		}
																	>
																		<RotateCcw className="mr-2 size-4" />
																		Revert to unpaid
																	</DropdownMenuItem>
																</>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			{payDialog?.row.payroll && (
				<MarkPaidDialog
					row={payDialog.row}
					onClose={() => setPayDialog(null)}
					onDone={() => {
						setPayDialog(null);
						router.refresh();
					}}
				/>
			)}

			{adjustDialog?.row.payroll && (
				<AdjustmentsDialog
					row={adjustDialog.row}
					onClose={() => setAdjustDialog(null)}
					onDone={() => {
						setAdjustDialog(null);
						router.refresh();
					}}
				/>
			)}
		</div>
	);
}

function MarkPaidDialog({
	row,
	onClose,
	onDone,
}: {
	row: PayrollRow;
	onClose: () => void;
	onDone: () => void;
}) {
	const payroll = row.payroll as PersistedPayroll;
	const [method, setMethod] = useState<PaymentMethodVal>("BANK_TRANSFER");
	const [reference, setReference] = useState("");
	const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));

	const markPaid = api.efms.markPayrollPaid.useMutation({
		onSuccess: () => {
			toast.success(`Payment recorded for ${row.teacherName}.`);
			onDone();
		},
		onError: (err) => toast.error(err.message),
	});

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Record payment</DialogTitle>
					<DialogDescription>
						Mark {row.teacherName}'s payroll of{" "}
						<strong>{currency.format(payroll.net)}</strong> as paid.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-1.5">
						<Label>Payment method</Label>
						<Select value={method} onValueChange={(v) => setMethod(v as PaymentMethodVal)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PAYMENT_METHODS.map((m) => (
									<SelectItem key={m.value} value={m.value}>
										{m.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="pay-ref">Reference / transaction ID</Label>
						<Input
							id="pay-ref"
							placeholder="optional (UTR, cheque no, etc.)"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="pay-date">Payment date</Label>
						<Input
							id="pay-date"
							type="date"
							value={paidAt}
							onChange={(e) => setPaidAt(e.target.value)}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						isLoading={markPaid.isPending}
						onClick={() =>
							markPaid.mutate({
								id: payroll.id,
								paymentMethod: method,
								paymentReference: reference.trim() || undefined,
								paidAt: new Date(paidAt),
							})
						}
					>
						<CheckCircle2 className="size-4" />
						Confirm payment
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AdjustmentsDialog({
	row,
	onClose,
	onDone,
}: {
	row: PayrollRow;
	onClose: () => void;
	onDone: () => void;
}) {
	const payroll = row.payroll as PersistedPayroll;
	const [bonus, setBonus] = useState(String(payroll.bonus || ""));
	const [deduction, setDeduction] = useState(String(payroll.deduction || ""));
	const [tds, setTds] = useState(String(payroll.tds || ""));
	const [note, setNote] = useState(payroll.adjustmentNote ?? "");

	const update = api.efms.updatePayrollAdjustments.useMutation({
		onSuccess: () => {
			toast.success("Adjustments saved.");
			onDone();
		},
		onError: (err) => toast.error(err.message),
	});

	const num = (v: string) => Number(v || 0);
	const net = payroll.totalAmount + num(bonus) - num(deduction) - num(tds);

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Adjustments — {row.teacherName}</DialogTitle>
					<DialogDescription>
						Gross payout is <strong>{currency.format(payroll.totalAmount)}</strong>.
						Add a bonus or subtract deductions/TDS to compute net pay.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="grid grid-cols-3 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="adj-bonus">Bonus</Label>
							<Input
								id="adj-bonus"
								type="number"
								min={0}
								step="0.01"
								value={bonus}
								onChange={(e) => setBonus(e.target.value)}
								placeholder="0"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="adj-ded">Deduction</Label>
							<Input
								id="adj-ded"
								type="number"
								min={0}
								step="0.01"
								value={deduction}
								onChange={(e) => setDeduction(e.target.value)}
								placeholder="0"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="adj-tds">TDS</Label>
							<Input
								id="adj-tds"
								type="number"
								min={0}
								step="0.01"
								value={tds}
								onChange={(e) => setTds(e.target.value)}
								placeholder="0"
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="adj-note">Note</Label>
						<Input
							id="adj-note"
							placeholder="optional (reason for adjustment)"
							value={note}
							onChange={(e) => setNote(e.target.value)}
						/>
					</div>
					<div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
						<span className="text-muted-foreground text-sm">Net pay</span>
						<span className="font-semibold text-lg tabular-nums">
							{currency.format(net)}
						</span>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						isLoading={update.isPending}
						onClick={() =>
							update.mutate({
								id: payroll.id,
								bonusAmount: num(bonus),
								deductionAmount: num(deduction),
								tdsAmount: num(tds),
								adjustmentNote: note.trim() || undefined,
							})
						}
					>
						Save adjustments
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-4">
			<p className="text-muted-foreground text-sm">{label}</p>
			<p className="mt-1 font-semibold text-2xl tabular-nums">{value}</p>
		</div>
	);
}
