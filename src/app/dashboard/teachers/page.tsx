import PageContainer from "@/components/layout/page-container";
import { TeachersView } from "@/features/teachers/components/teachers-view";
import type { TeacherRow } from "@/features/teachers/types";
import { api } from "@/trpc/server";

export const metadata = {
	title: "Dashboard: Teachers",
};

export default async function TeachersPage() {
	const teachers = await api.efms.listTeachers();

	// Convert Prisma Decimals to plain numbers so the data is safe to pass to a
	// client component.
	const rows: TeacherRow[] = teachers.map((teacher) => ({
		id: teacher.id,
		teacherCode: teacher.teacherCode,
		fullName: teacher.fullName,
		email: teacher.email,
		mobile: teacher.mobile,
		specialization: teacher.specialization,
		status: teacher.status,
		hasPortalAccess: !!teacher.userId,
		avatarKey: teacher.avatar ?? null,
		bankAccountNumber: teacher.bankAccountNumber ?? null,
		bankIfsc: teacher.bankIfsc ?? null,
		bankName: teacher.bankName ?? null,
		panNumber: teacher.panNumber ?? null,
		rates: teacher.payoutConfig
			? {
					liveRate: Number(teacher.payoutConfig.liveRate),
					recordingRate: Number(teacher.payoutConfig.recordingRate),
					youtubeRate: Number(teacher.payoutConfig.youtubeRate),
					doubtRate:
						teacher.payoutConfig.doubtRate == null
							? null
							: Number(teacher.payoutConfig.doubtRate),
					webinarRate:
						teacher.payoutConfig.webinarRate == null
							? null
							: Number(teacher.payoutConfig.webinarRate),
				}
			: null,
	}));

	return (
		<PageContainer
			pageTitle="Teachers"
			pageDescription="Manage faculty profiles, payout rates, and status."
		>
			<TeachersView teachers={rows} />
		</PageContainer>
	);
}
