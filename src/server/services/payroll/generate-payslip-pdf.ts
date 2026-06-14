type PayslipData = {
	teacherName: string;
	teacherCode: string;
	orgName: string;
	month: number;
	year: number;
	sessions: number;
	minutes: number;
	liveAmount: number;
	recordingAmount: number;
	youtubeAmount: number;
	otherAmount: number;
	totalAmount: number;
	status: string;
	paidAt?: Date | null;
	// Optional adjustments / payment metadata
	bonusAmount?: number;
	deductionAmount?: number;
	tdsAmount?: number;
	netAmount?: number;
	paymentMethod?: string | null;
	paymentReference?: string | null;
};

const MONTH_NAMES = [
	"January","February","March","April","May","June",
	"July","August","September","October","November","December",
];

const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
	const { default: jsPDF } = await import("jspdf");
	const autoTable = (await import("jspdf-autotable")).default;

	const doc = new jsPDF();
	const period = `${MONTH_NAMES[data.month - 1] ?? data.month} ${data.year}`;

	// Header
	doc.setFontSize(18);
	doc.setFont("helvetica", "bold");
	doc.text(data.orgName, 14, 20);
	doc.setFontSize(11);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(100);
	doc.text("Faculty Payslip", 14, 28);
	doc.setTextColor(0);

	// Teacher details
	doc.setFontSize(10);
	doc.text(`Teacher: ${data.teacherName} (${data.teacherCode})`, 14, 42);
	doc.text(`Period: ${period}`, 14, 50);
	doc.text(`Status: ${data.status}`, 14, 58);
	if (data.paidAt) {
		doc.text(`Paid on: ${new Date(data.paidAt).toLocaleDateString("en-IN")}`, 14, 66);
	}

	// Breakdown table
	const breakdownRows = [
		["Live Classes", fmt.format(data.liveAmount)],
		["Recordings", fmt.format(data.recordingAmount)],
		["YouTube", fmt.format(data.youtubeAmount)],
		["Doubt / Webinar / Other", fmt.format(data.otherAmount)],
	].filter(([, amt]) => amt !== fmt.format(0));

	autoTable(doc, {
		head: [["Session Type", "Amount"]],
		body: breakdownRows,
		startY: 76,
		styles: { fontSize: 10 },
		headStyles: { fillColor: [30, 30, 30] },
		columnStyles: { 1: { halign: "right" } },
	});

	const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

	// Adjustments + net (only show rows that are non-zero)
	const hasAdjustments =
		(data.bonusAmount ?? 0) > 0 ||
		(data.deductionAmount ?? 0) > 0 ||
		(data.tdsAmount ?? 0) > 0;
	const net = data.netAmount ?? data.totalAmount;

	const summaryRows: [string, string][] = [
		["Total sessions", String(data.sessions)],
		["Total hours", `${Math.floor(data.minutes / 60)}h ${data.minutes % 60}m`],
		["Gross payout", fmt.format(data.totalAmount)],
	];
	if ((data.bonusAmount ?? 0) > 0) summaryRows.push(["Bonus", `+ ${fmt.format(data.bonusAmount ?? 0)}`]);
	if ((data.deductionAmount ?? 0) > 0) summaryRows.push(["Deduction", `- ${fmt.format(data.deductionAmount ?? 0)}`]);
	if ((data.tdsAmount ?? 0) > 0) summaryRows.push(["TDS", `- ${fmt.format(data.tdsAmount ?? 0)}`]);
	summaryRows.push([hasAdjustments ? "Net payout" : "Total payout", fmt.format(net)]);

	autoTable(doc, {
		body: summaryRows,
		startY: finalY,
		styles: { fontSize: 10 },
		columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
		theme: "plain",
	});

	// Payment details footer
	if (data.status === "PAID" && data.paymentMethod) {
		const payY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
		doc.setFontSize(9);
		doc.setTextColor(100);
		const ref = data.paymentReference ? ` · Ref: ${data.paymentReference}` : "";
		doc.text(`Paid via ${data.paymentMethod.replace(/_/g, " ")}${ref}`, 14, payY);
		doc.setTextColor(0);
	}

	return Buffer.from(doc.output("arraybuffer"));
}
