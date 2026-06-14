import type { TeacherStatus } from "../../../generated/prisma";

export type TeacherRates = {
	liveRate: number;
	recordingRate: number;
	youtubeRate: number;
	doubtRate: number | null;
	webinarRate: number | null;
};

export type TeacherRow = {
	id: string;
	teacherCode: string;
	fullName: string;
	email: string | null;
	mobile: string | null;
	specialization: string | null;
	status: TeacherStatus;
	rates: TeacherRates | null;
	hasPortalAccess: boolean;
	avatarKey: string | null;
	bankAccountNumber: string | null;
	bankIfsc: string | null;
	bankName: string | null;
	panNumber: string | null;
};

// Plain literals (assignable to the Prisma TeacherStatus union) so client
// components don't import the Prisma runtime.
export const TEACHER_STATUS_OPTIONS: { value: TeacherStatus; label: string }[] =
	[
		{ value: "ACTIVE", label: "Active" },
		{ value: "INACTIVE", label: "Inactive" },
		{ value: "ARCHIVED", label: "Archived" },
	];

