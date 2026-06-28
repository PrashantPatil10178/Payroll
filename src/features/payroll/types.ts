import type { PayrollStatus } from "../../../generated/prisma";

export type PersistedPayroll = {
	id: string;
	status: PayrollStatus;
	totalAmount: number;
	live: number;
	recording: number;
	youtube: number;
	other: number;
	bonus: number;
	deduction: number;
	tds: number;
	net: number;
	adjustmentNote: string | null;
	paymentMethod: string | null;
	paymentReference: string | null;
	paidAt: string | null;
};

export const PAYMENT_METHODS = [
	{ value: "BANK_TRANSFER", label: "Bank Transfer" },
	{ value: "UPI", label: "UPI" },
	{ value: "CASH", label: "Cash" },
	{ value: "CHEQUE", label: "Cheque" },
	{ value: "OTHER", label: "Other" },
] as const;

export function paymentMethodLabel(method: string | null): string {
	if (!method) return "—";
	return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export type PayrollRow = {
	teacherId: string;
	teacherName: string;
	sessionCount: number;
	totalMinutes: number;
	computedAmount: number;
	payroll: PersistedPayroll | null;
	teacherUpiId: string | null;
	teacherBankAccount: string | null;
	teacherBankIfsc: string | null;
	teacherBankName: string | null;
	teacherPaymentQrKey: string | null;
};

export const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function monthLabel(month: number): string {
	return MONTHS[month - 1] ?? String(month);
}
