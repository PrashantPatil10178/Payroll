import * as XLSX from "xlsx";

export function downloadExcel(
	rows: Record<string, string | number>[],
	sheetName: string,
	filename: string,
) {
	const ws = XLSX.utils.json_to_sheet(rows);
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, sheetName);
	XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function downloadPdf(
	columns: string[],
	body: (string | number)[][],
	title: string,
	filename: string,
) {
	const { default: jsPDF } = await import("jspdf");
	const autoTable = (await import("jspdf-autotable")).default;

	const doc = new jsPDF({ orientation: "landscape" });
	doc.setFontSize(14);
	doc.text(title, 14, 15);
	autoTable(doc, {
		head: [columns],
		body: body,
		startY: 22,
		styles: { fontSize: 8 },
		headStyles: { fillColor: [30, 30, 30] },
	});
	doc.save(`${filename}.pdf`);
}
