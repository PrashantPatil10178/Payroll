"use client";

import {
	Building2,
	CheckCircle2,
	Copy,
	MoreHorizontal,
	Pencil,
	RefreshCw,
	RotateCcw,
	Wallet,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
				<>
					{/* Mobile card list */}
					<div className="md:hidden space-y-2">
						{rows.map((row) => {
							const p = row.payroll;
							const net = p ? p.net : row.computedAmount;
							return (
								<div key={row.teacherId} className="rounded-lg border bg-card p-3 space-y-2">
									{/* Top row: name + status */}
									<div className="flex items-start justify-between gap-3">
										<p className="font-medium text-sm leading-none min-w-0 truncate">{row.teacherName}</p>
										{p ? (
											<StatusCell payroll={p} />
										) : (
											<Badge variant="outline" className="text-xs shrink-0">no payroll</Badge>
										)}
									</div>

									{/* Sessions count */}
									<p className="text-muted-foreground text-xs">
										{row.sessionCount} session{row.sessionCount === 1 ? "" : "s"}
									</p>

									{/* Net pay */}
									<p className="font-medium text-sm tabular-nums">
										Net: {currency.format(net)}
									</p>

									{/* Actions row */}
									<div className="flex items-center gap-1 pt-1 border-t">
										{!p ? (
											<span className="text-muted-foreground text-xs">pending generation</span>
										) : (
											<>
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
														<Button disabled={busy} size="sm" variant="ghost" className="size-8 p-0">
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
																	onClick={() => setStatus.mutate({ id: p.id, status: "GENERATED" })}
																>
																	<RotateCcw className="mr-2 size-4" />
																	Revert to unpaid
																</DropdownMenuItem>
															</>
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											</>
										)}
									</div>
								</div>
							);
						})}
					</div>

					{/* Desktop table */}
					<div className="hidden md:block rounded-lg border">
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
				</>
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

const UPI_APPS = [
	{
		id: "gpay" as const,
		label: "Google Pay",
		icon: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://pay.google.com&size=128",
	},
	{
		id: "phonepe" as const,
		label: "PhonePe",
		icon: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://phonepe.com&size=128",
	},
];

function UpiQrPanel({ upiId, amount, payeeName }: { upiId: string; amount: number; payeeName: string }) {
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [appLinks, setAppLinks] = useState<{ id: string; label: string; icon: string; url: string }[]>([]);
	const [upiUri, setUpiUri] = useState("");

	useEffect(() => {
		let cancelled = false;
		import("upi-intents").then(({ createPaymentUri, buildAppLink, detectPlatform }) => {
			const uri = createPaymentUri(upiId, payeeName, amount.toFixed(2), "Salary payment");
			if (cancelled) return;
			setUpiUri(uri);
			const platform = detectPlatform();
			const links = UPI_APPS.map((app) => ({ ...app, url: buildAppLink({ appId: app.id, upiUri: uri, platform }).url }));
			if (!cancelled) setAppLinks(links);
		});
		import("qrcode").then((QRCode) => {
			const uri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Salary payment")}`;
			QRCode.toDataURL(uri, { width: 180, margin: 1, color: { dark: "#000000", light: "#ffffff" } }).then((url) => {
				if (!cancelled) setQrDataUrl(url);
			});
		});
		return () => { cancelled = true; };
	}, [upiId, amount, payeeName]);

	return (
		<div className="space-y-4 rounded-xl border bg-muted/30 p-4">
			<div className="flex items-center justify-between">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">UPI Payment</p>
				<span className="text-lg font-bold text-green-600">{currency.format(amount)}</span>
			</div>
			<div className="flex gap-4">
				<div className="flex shrink-0 items-center justify-center rounded-xl border bg-white p-2 shadow-sm">
					{qrDataUrl ? (
						<img alt="UPI QR code" className="size-30 rounded" src={qrDataUrl} />
					) : (
						<div className="size-30 animate-pulse rounded-lg bg-muted" />
					)}
				</div>
				<div className="flex min-w-0 flex-col justify-center gap-3">
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">UPI ID</p>
						<div className="mt-0.5 flex items-center gap-1.5">
							<span className="truncate font-mono text-sm font-semibold">{upiId}</span>
							<button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => { void navigator.clipboard.writeText(upiId); toast.success("UPI ID copied"); }} type="button">
								<Copy className="size-3.5" />
							</button>
						</div>
					</div>
					{upiUri && (
						<button className="flex w-fit items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline" onClick={() => { void navigator.clipboard.writeText(upiUri); toast.success("Intent link copied"); }} type="button">
							<Copy className="size-3" />Copy intent URL
						</button>
					)}
					<p className="text-[10px] leading-relaxed text-muted-foreground">Scan with any UPI app</p>
				</div>
			</div>
			<div>
				<p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Open directly in app</p>
				<div className="flex gap-2">
					{UPI_APPS.map((app) => {
						const link = appLinks.find((l) => l.id === app.id);
						return (
							<a className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-accent" href={link?.url ?? `upi://pay?pa=${encodeURIComponent(upiId)}`} key={app.id} rel="noreferrer" target="_blank">
								<img alt={app.label} className="size-4 rounded-sm" src={app.icon} />
								{app.label}
							</a>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function BankPanel({ accountNumber, ifsc, bankName, amount }: { accountNumber: string | null; ifsc: string | null; bankName: string | null; amount: number }) {
	if (!accountNumber && !ifsc && !bankName) {
		return <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">No bank details saved for this member.</div>;
	}
	const copy = (val: string, label: string) => { void navigator.clipboard.writeText(val); toast.success(`${label} copied`); };
	return (
		<div className="rounded-xl border bg-muted/30 p-4">
			<div className="mb-3 flex items-center gap-2">
				<Building2 className="size-4 text-muted-foreground" />
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank Transfer</p>
			</div>
			<div className="grid grid-cols-2 gap-3 text-sm">
				{accountNumber && (
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Account No.</p>
						<div className="mt-0.5 flex items-center gap-1.5">
							<span className="font-mono font-semibold">{accountNumber}</span>
							<button className="text-muted-foreground hover:text-foreground" onClick={() => copy(accountNumber, "Account number")} type="button"><Copy className="size-3" /></button>
						</div>
					</div>
				)}
				{ifsc && (
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">IFSC</p>
						<div className="mt-0.5 flex items-center gap-1.5">
							<span className="font-mono font-semibold">{ifsc}</span>
							<button className="text-muted-foreground hover:text-foreground" onClick={() => copy(ifsc, "IFSC")} type="button"><Copy className="size-3" /></button>
						</div>
					</div>
				)}
				{bankName && <div className="col-span-2"><p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bank</p><p className="mt-0.5 font-medium">{bankName}</p></div>}
				<div className="col-span-2 mt-1 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/30">
					<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Transfer Amount</p>
					<p className="mt-0.5 text-lg font-bold text-green-600">{currency.format(amount)}</p>
				</div>
			</div>
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
			<DialogContent className="sm:max-w-lg">
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

					{method === "UPI" && row.teacherUpiId && (
						<UpiQrPanel amount={payroll.net} payeeName={row.teacherName} upiId={row.teacherUpiId} />
					)}
					{method === "UPI" && !row.teacherUpiId && (
						<div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
							No UPI ID saved for this member. Add it in the member profile.
						</div>
					)}
					{method === "BANK_TRANSFER" && (
						<BankPanel accountNumber={row.teacherBankAccount} amount={payroll.net} bankName={row.teacherBankName} ifsc={row.teacherBankIfsc} />
					)}

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
