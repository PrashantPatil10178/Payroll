import PageContainer from "@/components/layout/page-container";
import { PayrollView } from "@/features/payroll/components/payroll-view";
import type { PayrollRow } from "@/features/payroll/types";
import { api } from "@/trpc/server";

export const metadata = {
	title: "Dashboard: Payroll",
};

type PageProps = {
	searchParams: Promise<{ month?: string; year?: string }>;
};

export default async function PayrollPage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const now = new Date();
	const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
	const year = sp.year ? Number(sp.year) : now.getFullYear();

	const [preview, payrolls] = await Promise.all([
		api.efms.payrollPreview({ month, year }),
		api.efms.listPayrolls({ month, year }),
	]);

	const map = new Map<string, PayrollRow>();

	for (const row of preview) {
		map.set(row.teacherId, {
			teacherId: row.teacherId,
			teacherName: row.teacherName,
			sessionCount: row.sessionCount,
			totalMinutes: row.totalMinutes,
			computedAmount: row.totalAmount,
			payroll: null,
		});
	}

	for (const p of payrolls) {
		const persisted = {
			id: p.id,
			status: p.status,
			totalAmount: Number(p.totalAmount),
			live: Number(p.liveAmount),
			recording: Number(p.recordingAmount),
			youtube: Number(p.youtubeAmount),
			other: Number(p.otherAmount),
			bonus: Number(p.bonusAmount),
			deduction: Number(p.deductionAmount),
			tds: Number(p.tdsAmount),
			net: Number(p.netAmount || p.totalAmount),
			adjustmentNote: p.adjustmentNote,
			paymentMethod: p.paymentMethod ? String(p.paymentMethod) : null,
			paymentReference: p.paymentReference,
			paidAt: p.paidAt ? p.paidAt.toISOString() : null,
		};
		const existing = map.get(p.teacherId);
		if (existing) {
			existing.payroll = persisted;
		} else {
			map.set(p.teacherId, {
				teacherId: p.teacherId,
				teacherName: p.teacher.fullName,
				sessionCount: p.sessionCount,
				totalMinutes: p.totalMinutes,
				computedAmount: persisted.totalAmount,
				payroll: persisted,
			});
		}
	}

	const rows = [...map.values()].sort((a, b) =>
		a.teacherName.localeCompare(b.teacherName),
	);

	return (
		<PageContainer
			pageTitle="Payroll"
			pageDescription="Generate and track monthly payouts per teacher."
		>
			<PayrollView month={month} rows={rows} year={year} />
		</PageContainer>
	);
}
