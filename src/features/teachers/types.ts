import type { MemberType, RateUnit, TeacherStatus } from "../../../generated/prisma";

export type TeacherRates = {
	liveRate: number;
	liveRateUnit: RateUnit;
	recordingRate: number;
	recordingRateUnit: RateUnit;
	youtubeRate: number;
	youtubeRateUnit: RateUnit;
	doubtRate: number | null;
	doubtRateUnit: RateUnit;
	webinarRate: number | null;
	webinarRateUnit: RateUnit;
};

export type TeacherRow = {
	id: string;
	teacherCode: string;
	fullName: string;
	memberType: MemberType;
	roleTitle: string | null;
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
	upiId: string | null;
	paymentQrCodeKey: string | null;
};

// Plain literals (assignable to the Prisma TeacherStatus union) so client
// components don't import the Prisma runtime.
export const TEACHER_STATUS_OPTIONS: { value: TeacherStatus; label: string }[] =
	[
		{ value: "ACTIVE", label: "Active" },
		{ value: "INACTIVE", label: "Inactive" },
		{ value: "ARCHIVED", label: "Archived" },
	];
