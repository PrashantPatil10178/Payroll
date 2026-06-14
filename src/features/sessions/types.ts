import type { SessionStatus, SessionType } from "../../../generated/prisma";

export type SessionRow = {
	id: string;
	title: string;
	teacherId: string;
	teacherName: string;
	teacherCode: string;
	sessionType: SessionType;
	status: SessionStatus;
	date: string; // ISO
	startTime: string; // ISO
	endTime: string; // ISO
	durationMinutes: number;
	amount: number;
	remarks: string | null;
	attachments: string[];
};

export type TeacherOption = {
	id: string;
	teacherCode: string;
	fullName: string;
};

// Plain literals assignable to the Prisma SessionType union (no Prisma runtime
// import in client components).
export const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
	{ value: "LIVE_CLASS", label: "Live Class" },
	{ value: "RECORDING", label: "Recording" },
	{ value: "YOUTUBE", label: "YouTube" },
	{ value: "DOUBT_SOLVING", label: "Doubt Solving" },
	{ value: "WEBINAR", label: "Webinar" },
];

export function sessionTypeLabel(type: SessionType): string {
	return (
		SESSION_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
	);
}
