import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import PageContainer from "@/components/layout/page-container";
import { MemberDetailView } from "@/features/teachers/components/member-detail-view";
import type { TeacherRow } from "@/features/teachers/types";
import { api } from "@/trpc/server";

export default async function MemberDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	let teacher;
	try {
		teacher = await api.efms.getTeacher({ id });
	} catch {
		notFound();
	}

	const row: TeacherRow = {
		id: teacher.id,
		teacherCode: teacher.teacherCode,
		fullName: teacher.fullName,
		memberType: teacher.memberType,
		roleTitle: teacher.roleTitle,
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
		upiId: teacher.upiId ?? null,
		paymentQrCodeKey: teacher.paymentQrCode ?? null,
		rates: teacher.payoutConfig
			? {
					liveRate: Number(teacher.payoutConfig.liveRate),
					liveRateUnit: teacher.payoutConfig.liveRateUnit,
					recordingRate: Number(teacher.payoutConfig.recordingRate),
					recordingRateUnit: teacher.payoutConfig.recordingRateUnit,
					youtubeRate: Number(teacher.payoutConfig.youtubeRate),
					youtubeRateUnit: teacher.payoutConfig.youtubeRateUnit,
					doubtRate:
						teacher.payoutConfig.doubtRate == null
							? null
							: Number(teacher.payoutConfig.doubtRate),
					doubtRateUnit: teacher.payoutConfig.doubtRateUnit,
					webinarRate:
						teacher.payoutConfig.webinarRate == null
							? null
							: Number(teacher.payoutConfig.webinarRate),
					webinarRateUnit: teacher.payoutConfig.webinarRateUnit,
				}
			: null,
	};

	const typeLabel = teacher.memberType === "FREELANCER" ? "Freelancer" : "Teacher";

	return (
		<PageContainer
			pageTitle={teacher.fullName}
			pageDescription={`${typeLabel} · ${teacher.teacherCode}`}
		>
			<div className="mb-4">
				<Link
					href="/dashboard/teachers"
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ChevronLeft className="size-4" />
					Back to Members
				</Link>
			</div>
			<MemberDetailView teacher={row} />
		</PageContainer>
	);
}
