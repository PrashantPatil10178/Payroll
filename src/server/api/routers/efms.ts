import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	tenantProcedure,
} from "@/server/api/trpc";
import {
	calculateDurationMinutes,
	calculatePayoutAmount,
} from "@/server/services/payroll/calculate-payout";
import {
	deleteObject,
	getPresignedUrl,
	uploadBuffer,
} from "@/server/storage/minio";
import {
	MemberType,
	PaymentMethod,
	type PrismaClient,
	PayrollStatus,
	RateUnit,
	Role,
	SessionStatus,
	SessionType,
	TeacherStatus,
} from "../../../../generated/prisma";

const money = z.number().nonnegative().max(1_000_000);
const rateUnitSchema = z.nativeEnum(RateUnit);

const payoutInputSchema = z.object({
	liveRate: money,
	liveRateUnit: rateUnitSchema,
	recordingRate: money,
	recordingRateUnit: rateUnitSchema,
	youtubeRate: money,
	youtubeRateUnit: rateUnitSchema,
	doubtRate: money.optional(),
	doubtRateUnit: rateUnitSchema,
	webinarRate: money.optional(),
	webinarRateUnit: rateUnitSchema,
});

const teacherCreateInputSchema = z
	.object({
		teacherCode: z.string().min(2).max(24).optional().or(z.literal("")),
		fullName: z.string().min(2).max(120),
		roleTitle: z.string().max(80).optional(),
		email: z.string().email().optional().or(z.literal("")),
		mobile: z.string().min(8).max(20).optional().or(z.literal("")),
		memberType: z.nativeEnum(MemberType).default(MemberType.TEACHER),
		specialization: z.string().max(80).optional(),
		bankAccountNumber: z.string().max(40).optional(),
		bankIfsc: z.string().max(20).optional(),
		bankName: z.string().max(80).optional(),
		panNumber: z.string().max(20).optional(),
		upiId: z.string().max(120).optional(),
		paymentQrCodeFileName: z.string().max(180).optional(),
		paymentQrCodeDataUrl: z.string().optional(),
	})
	.extend(payoutInputSchema.shape);

const teacherUpdateInputSchema = z
	.object({
		id: z.string().cuid(),
		teacherCode: z.string().min(2).max(24),
		fullName: z.string().min(2).max(120),
		roleTitle: z.string().max(80).optional().or(z.literal("")),
		email: z.string().email().optional().or(z.literal("")),
		mobile: z.string().min(8).max(20).optional().or(z.literal("")),
		memberType: z.nativeEnum(MemberType).default(MemberType.TEACHER),
		specialization: z.string().max(80).optional().or(z.literal("")),
		bankAccountNumber: z.string().max(40).optional().or(z.literal("")),
		bankIfsc: z.string().max(20).optional().or(z.literal("")),
		bankName: z.string().max(80).optional().or(z.literal("")),
		panNumber: z.string().max(20).optional().or(z.literal("")),
		upiId: z.string().max(120).optional().or(z.literal("")),
		paymentQrCodeFileName: z.string().max(180).optional(),
		paymentQrCodeDataUrl: z.string().optional(),
		status: z.nativeEnum(TeacherStatus),
	})
	.extend(payoutInputSchema.shape);

const sessionInputShape = {
	teacherId: z.string().cuid(),
	sessionType: z.nativeEnum(SessionType),
	title: z.string().min(2).max(160),
	date: z.coerce.date(),
	startTime: z.coerce.date().optional(),
	endTime: z.coerce.date().optional(),
	durationMinutes: z
		.number()
		.int()
		.positive()
		.max(24 * 60)
		.optional(),
	rateOverride: z.number().nonnegative().optional(),
	remarks: z.string().max(500).optional(),
};

const sessionInputSchema = z
	.object(sessionInputShape)
	.superRefine((value, ctx) => {
		const hasManualDuration = value.durationMinutes != null;
		const hasTimeRange = value.startTime && value.endTime;

		if (!hasManualDuration && !hasTimeRange) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Provide either a duration or both start and end time.",
				path: ["durationMinutes"],
			});
		}
	});

async function getNextTeacherCode(ctx: {
	db: PrismaClient;
	tenant: { organizationId: string };
}) {
	const teachers = await ctx.db.teacher.findMany({
		where: { organizationId: ctx.tenant.organizationId },
		select: { teacherCode: true },
	});

	const nextNumber =
		teachers.reduce((max: number, teacher: { teacherCode: string }) => {
			const match = teacher.teacherCode.match(/(\d+)(?!.*\d)/);
			return match ? Math.max(max, Number(match[1])) : max;
		}, 0) + 1;

	return `EL-${String(nextNumber).padStart(3, "0")}`;
}

function normalizeSessionTiming(input: z.infer<typeof sessionInputSchema>) {
	if (input.durationMinutes != null) {
		const durationMinutes = input.durationMinutes;
		const startTime = input.startTime ?? new Date(input.date);
		const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
		return { startTime, endTime, durationMinutes };
	}

	if (!input.startTime || !input.endTime) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Provide either a duration or both start and end time.",
		});
	}

	return {
		startTime: input.startTime,
		endTime: input.endTime,
		durationMinutes: calculateDurationMinutes(input.startTime, input.endTime),
	};
}

async function uploadTeacherPaymentQr({
	orgId,
	teacherId,
	dataUrl,
	fileName,
	existingKey,
}: {
	orgId: string;
	teacherId: string;
	dataUrl: string;
	fileName?: string;
	existingKey?: string | null;
}) {
	const [header, b64] = dataUrl.split(",");
	const contentType = header?.match(/:(.*?);/)?.[1] ?? "image/png";
	const buffer = Buffer.from(b64 ?? "", "base64");
	const extension =
		fileName
			?.split(".")
			.pop()
			?.replace(/[^a-zA-Z0-9]/g, "")
			.toLowerCase() ||
		(contentType.includes("jpeg")
			? "jpg"
			: contentType.includes("svg")
				? "svg"
				: "png");
	const key = `payment-qr/${orgId}/${teacherId}.${extension}`;

	if (existingKey) {
		try {
			await deleteObject(existingKey);
		} catch {
			// Ignore storage cleanup issues while replacing the QR code.
		}
	}

	await uploadBuffer(key, buffer, contentType);
	return key;
}

export const efmsRouter = createTRPCRouter({
	overview: tenantProcedure.query(async ({ ctx }) => {
		const organizationId = ctx.tenant.organizationId;
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

		const [organization, totalTeachers, sessions, payout] = await Promise.all([
			ctx.db.organization.findUnique({
				where: { id: organizationId },
				select: { name: true, slug: true, status: true },
			}),
			ctx.db.teacher.count({
				where: { organizationId, status: TeacherStatus.ACTIVE },
			}),
			ctx.db.facultySession.findMany({
				where: {
					organizationId,
					date: { gte: monthStart, lt: nextMonthStart },
				},
				include: { teacher: { select: { fullName: true } } },
				orderBy: { date: "desc" },
			}),
			ctx.db.facultySession.aggregate({
				where: {
					organizationId,
					date: { gte: monthStart, lt: nextMonthStart },
				},
				_sum: { amount: true, durationMinutes: true },
			}),
		]);

		return buildOverview({
			organization: organization ?? {
				name: "Unassigned Organization",
				slug: "unassigned",
				status: "SETUP_REQUIRED",
			},
			sessions,
			totalTeachers,
			totalMinutes: payout._sum.durationMinutes ?? 0,
			totalPayout: Number(payout._sum.amount ?? 0),
		});
	}),

	listTeachers: tenantProcedure.query(({ ctx }) => {
		return ctx.db.teacher.findMany({
			where: { organizationId: ctx.tenant.organizationId },
			include: { payoutConfig: true },
			orderBy: [{ status: "asc" }, { fullName: "asc" }],
		});
	}),

	nextTeacherCode: tenantProcedure.query(({ ctx }) => getNextTeacherCode(ctx)),

	getTeacher: tenantProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				include: { payoutConfig: true },
			});

			if (!teacher) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Teacher not found.",
				});
			}

			return teacher;
		}),

	createTeacher: tenantProcedure
		.input(teacherCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const teacherCode =
				input.teacherCode?.trim() || (await getNextTeacherCode(ctx));
			const teacher = await ctx.db.teacher.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					teacherCode,
					fullName: input.fullName,
					memberType: input.memberType,
					roleTitle: input.roleTitle,
					email: input.email,
					mobile: input.mobile || null,
					specialization: input.specialization || null,
					bankAccountNumber: input.bankAccountNumber || null,
					bankIfsc: input.bankIfsc || null,
					bankName: input.bankName || null,
					panNumber: input.panNumber || null,
					upiId: input.upiId || null,
					payoutConfig: {
						create: {
							liveRate: input.liveRate,
							liveRateUnit: input.liveRateUnit,
							recordingRate: input.recordingRate,
							recordingRateUnit: input.recordingRateUnit,
							youtubeRate: input.youtubeRate,
							youtubeRateUnit: input.youtubeRateUnit,
							doubtRate: input.doubtRate,
							doubtRateUnit: input.doubtRateUnit,
							webinarRate: input.webinarRate,
							webinarRateUnit: input.webinarRateUnit,
						},
					},
				},
			});

			if (input.paymentQrCodeDataUrl) {
				const paymentQrCode = await uploadTeacherPaymentQr({
					orgId: ctx.tenant.organizationId,
					teacherId: teacher.id,
					dataUrl: input.paymentQrCodeDataUrl,
					fileName: input.paymentQrCodeFileName,
				});
				await ctx.db.teacher.update({
					where: { id: teacher.id },
					data: { paymentQrCode },
				});
			}

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "TEACHER_ADDED",
					entity: "Teacher",
					entityId: teacher.id,
					newValue: input,
				},
			});

			return teacher;
		}),

	updateTeacher: tenantProcedure
		.input(teacherUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.teacher.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				include: { payoutConfig: true },
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Teacher not found.",
				});
			}

			const payoutData = {
				liveRate: input.liveRate,
				liveRateUnit: input.liveRateUnit,
				recordingRate: input.recordingRate,
				recordingRateUnit: input.recordingRateUnit,
				youtubeRate: input.youtubeRate,
				youtubeRateUnit: input.youtubeRateUnit,
				doubtRate: input.doubtRate,
				doubtRateUnit: input.doubtRateUnit,
				webinarRate: input.webinarRate,
				webinarRateUnit: input.webinarRateUnit,
			};

			let paymentQrCode = existing.paymentQrCode;
			if (input.paymentQrCodeDataUrl) {
				paymentQrCode = await uploadTeacherPaymentQr({
					orgId: ctx.tenant.organizationId,
					teacherId: existing.id,
					dataUrl: input.paymentQrCodeDataUrl,
					fileName: input.paymentQrCodeFileName,
					existingKey: existing.paymentQrCode,
				});
			}

			const teacher = await ctx.db.teacher.update({
				where: { id: existing.id },
				data: {
					teacherCode: input.teacherCode,
					fullName: input.fullName,
					memberType: input.memberType,
					roleTitle: input.roleTitle || null,
					email: input.email || null,
					mobile: input.mobile || null,
					specialization: input.specialization || null,
					bankAccountNumber: input.bankAccountNumber || null,
					bankIfsc: input.bankIfsc || null,
					bankName: input.bankName || null,
					panNumber: input.panNumber || null,
					upiId: input.upiId || null,
					paymentQrCode,
					status: input.status,
					payoutConfig: {
						upsert: { create: payoutData, update: payoutData },
					},
				},
				include: { payoutConfig: true },
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "TEACHER_UPDATED",
					entity: "Teacher",
					entityId: teacher.id,
					newValue: input,
				},
			});

			return teacher;
		}),

	archiveTeacher: tenantProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				status: z.nativeEnum(TeacherStatus).default(TeacherStatus.ARCHIVED),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.teacher.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				select: { id: true, status: true },
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Teacher not found.",
				});
			}

			const teacher = await ctx.db.teacher.update({
				where: { id: existing.id },
				data: { status: input.status },
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "TEACHER_STATUS_CHANGED",
					entity: "Teacher",
					entityId: teacher.id,
					oldValue: { status: existing.status },
					newValue: { status: input.status },
				},
			});

			return teacher;
		}),

	createSession: tenantProcedure
		.input(sessionInputSchema)
		.mutation(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.findFirst({
				where: {
					id: input.teacherId,
					organizationId: ctx.tenant.organizationId,
				},
				include: { payoutConfig: true },
			});

			if (!teacher?.payoutConfig) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Teacher or payout configuration was not found.",
				});
			}

			const { startTime, endTime, durationMinutes } =
				normalizeSessionTiming(input);
			const amount = input.rateOverride != null
				? Number(((durationMinutes / 60) * input.rateOverride).toFixed(2))
				: calculatePayoutAmount({
					durationMinutes,
					rates: teacher.payoutConfig,
					sessionType: input.sessionType,
				});

			const session = await ctx.db.facultySession.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					teacherId: input.teacherId,
					sessionType: input.sessionType,
					title: input.title,
					date: input.date,
					startTime,
					endTime,
					durationMinutes,
					amount,
					remarks: input.remarks,
					status: SessionStatus.DRAFT, // requires approval before counting toward payroll
				},
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "SESSION_CREATED",
					entity: "FacultySession",
					entityId: session.id,
					newValue: {
						...input,
						durationMinutes,
						amount,
					},
				},
			});

			return session;
		}),

	teacherOptions: tenantProcedure.query(({ ctx }) => {
		return ctx.db.teacher.findMany({
			where: {
				organizationId: ctx.tenant.organizationId,
				status: TeacherStatus.ACTIVE,
			},
			select: {
				id: true,
				teacherCode: true,
				fullName: true,
				memberType: true,
				payoutConfig: {
					select: {
						liveRate: true, liveRateUnit: true,
						recordingRate: true, recordingRateUnit: true,
						youtubeRate: true, youtubeRateUnit: true,
						doubtRate: true, doubtRateUnit: true,
						webinarRate: true, webinarRateUnit: true,
					},
				},
			},
			orderBy: { fullName: "asc" },
		});
	}),

	listSessions: tenantProcedure
		.input(
			z
				.object({
					teacherId: z.string().cuid().optional(),
					sessionType: z.nativeEnum(SessionType).optional(),
					month: z.number().int().min(1).max(12).optional(),
					year: z.number().int().min(2000).max(2100).optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const filters = input ?? {};
			const dateRange =
				filters.month && filters.year
					? {
							gte: new Date(filters.year, filters.month - 1, 1),
							lt: new Date(filters.year, filters.month, 1),
						}
					: undefined;

			return ctx.db.facultySession.findMany({
				where: {
					organizationId: ctx.tenant.organizationId,
					...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
					...(filters.sessionType ? { sessionType: filters.sessionType } : {}),
					...(dateRange ? { date: dateRange } : {}),
				},
				include: {
					teacher: { select: { fullName: true, teacherCode: true } },
				},
				orderBy: [{ date: "desc" }, { startTime: "desc" }],
			});
		}),

	updateSession: tenantProcedure
		.input(
			z
				.object({
					id: z.string().cuid(),
					...sessionInputShape,
					remarks: z.string().max(500).optional().or(z.literal("")),
				})
				.superRefine((value, ctx) => {
					const hasManualDuration = value.durationMinutes != null;
					const hasTimeRange = value.startTime && value.endTime;

					if (!hasManualDuration && !hasTimeRange) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: "Provide either a duration or both start and end time.",
							path: ["durationMinutes"],
						});
					}
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.facultySession.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found.",
				});
			}

			const teacher = await ctx.db.teacher.findFirst({
				where: {
					id: input.teacherId,
					organizationId: ctx.tenant.organizationId,
				},
				include: { payoutConfig: true },
			});

			if (!teacher?.payoutConfig) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Teacher or payout configuration was not found.",
				});
			}

			const { startTime, endTime, durationMinutes } =
				normalizeSessionTiming(input);
			const amount = calculatePayoutAmount({
				durationMinutes,
				rates: teacher.payoutConfig,
				sessionType: input.sessionType,
			});

			const session = await ctx.db.facultySession.update({
				where: { id: existing.id },
				data: {
					teacherId: input.teacherId,
					sessionType: input.sessionType,
					title: input.title,
					date: input.date,
					startTime,
					endTime,
					durationMinutes,
					amount,
					remarks: input.remarks || null,
				},
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "SESSION_UPDATED",
					entity: "FacultySession",
					entityId: session.id,
					newValue: { ...input, durationMinutes, amount },
				},
			});

			return session;
		}),

	deleteSession: tenantProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.facultySession.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found.",
				});
			}

			await ctx.db.facultySession.delete({ where: { id: existing.id } });

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "SESSION_DELETED",
					entity: "FacultySession",
					entityId: existing.id,
					oldValue: {
						title: existing.title,
						teacherId: existing.teacherId,
						amount: Number(existing.amount),
					},
				},
			});

			return { id: existing.id };
		}),

	// ─── Session Approval Workflow ─────────────────────────────────────────────

	setSessionStatus: tenantProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				status: z.nativeEnum(SessionStatus),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.facultySession.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				select: { id: true, status: true },
			});
			if (!existing)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found.",
				});

			const session = await ctx.db.facultySession.update({
				where: { id: existing.id },
				data: { status: input.status },
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action:
						input.status === SessionStatus.APPROVED
							? "SESSION_APPROVED"
							: "SESSION_STATUS_CHANGED",
					entity: "FacultySession",
					entityId: session.id,
					oldValue: { status: existing.status },
					newValue: { status: input.status },
				},
			});

			return session;
		}),

	bulkApproveSessions: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12),
				year: z.number().int().min(2000).max(2100),
				teacherId: z.string().cuid().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const start = new Date(input.year, input.month - 1, 1);
			const end = new Date(input.year, input.month, 1);

			const result = await ctx.db.facultySession.updateMany({
				where: {
					organizationId: ctx.tenant.organizationId,
					status: SessionStatus.DRAFT,
					date: { gte: start, lt: end },
					...(input.teacherId ? { teacherId: input.teacherId } : {}),
				},
				data: { status: SessionStatus.APPROVED },
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "SESSIONS_BULK_APPROVED",
					entity: "FacultySession",
					entityId: `${input.year}-${String(input.month).padStart(2, "0")}`,
					newValue: {
						approved: result.count,
						teacherId: input.teacherId ?? null,
					},
				},
			});

			return { approved: result.count };
		}),

	payrollPreview: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12),
				year: z.number().int().min(2024).max(2100),
			}),
		)
		.query(async ({ ctx, input }) => {
			const monthStart = new Date(input.year, input.month - 1, 1);
			const nextMonthStart = new Date(input.year, input.month, 1);
			const sessions = await ctx.db.facultySession.findMany({
				where: {
					organizationId: ctx.tenant.organizationId,
					date: { gte: monthStart, lt: nextMonthStart },
					status: SessionStatus.APPROVED,
				},
				include: { teacher: { select: { id: true, fullName: true } } },
			});

			const byTeacher = new Map<
				string,
				{
					teacherId: string;
					teacherName: string;
					totalAmount: number;
					totalMinutes: number;
					sessionCount: number;
				}
			>();

			for (const session of sessions) {
				const row = byTeacher.get(session.teacherId) ?? {
					teacherId: session.teacherId,
					teacherName: session.teacher.fullName,
					totalAmount: 0,
					totalMinutes: 0,
					sessionCount: 0,
				};
				row.totalAmount += Number(session.amount);
				row.totalMinutes += session.durationMinutes;
				row.sessionCount += 1;
				byTeacher.set(session.teacherId, row);
			}

			return [...byTeacher.values()].map((row) => ({
				...row,
				totalAmount: Number(row.totalAmount.toFixed(2)),
			}));
		}),

	generatePayroll: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12),
				year: z.number().int().min(2024).max(2100),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.tenant.organizationId;
			const monthStart = new Date(input.year, input.month - 1, 1);
			const nextMonthStart = new Date(input.year, input.month, 1);

			const sessions = await ctx.db.facultySession.findMany({
				where: {
					organizationId,
					date: { gte: monthStart, lt: nextMonthStart },
					status: SessionStatus.APPROVED,
				},
				select: {
					teacherId: true,
					sessionType: true,
					amount: true,
					durationMinutes: true,
				},
			});

			type Agg = {
				live: number;
				recording: number;
				youtube: number;
				other: number;
				total: number;
				minutes: number;
				count: number;
			};
			const byTeacher = new Map<string, Agg>();

			for (const session of sessions) {
				const agg = byTeacher.get(session.teacherId) ?? {
					live: 0,
					recording: 0,
					youtube: 0,
					other: 0,
					total: 0,
					minutes: 0,
					count: 0,
				};
				const amount = Number(session.amount);
				agg.total += amount;
				agg.minutes += session.durationMinutes;
				agg.count += 1;
				if (session.sessionType === SessionType.LIVE_CLASS) {
					agg.live += amount;
				} else if (session.sessionType === SessionType.RECORDING) {
					agg.recording += amount;
				} else if (session.sessionType === SessionType.YOUTUBE) {
					agg.youtube += amount;
				} else {
					agg.other += amount;
				}
				byTeacher.set(session.teacherId, agg);
			}

			const round = (value: number) => Number(value.toFixed(2));
			let generated = 0;
			let skippedPaid = 0;

			for (const [teacherId, agg] of byTeacher) {
				const key = {
					organizationId_teacherId_month_year: {
						organizationId,
						teacherId,
						month: input.month,
						year: input.year,
					},
				};
				const existing = await ctx.db.payroll.findUnique({
					where: key,
					select: {
						status: true,
						bonusAmount: true,
						deductionAmount: true,
						tdsAmount: true,
					},
				});
				if (existing?.status === PayrollStatus.PAID) {
					skippedPaid += 1;
					continue;
				}

				// Preserve any existing adjustments when regenerating
				const bonus = Number(existing?.bonusAmount ?? 0);
				const deduction = Number(existing?.deductionAmount ?? 0);
				const tds = Number(existing?.tdsAmount ?? 0);
				const net = round(agg.total + bonus - deduction - tds);

				const data = {
					totalAmount: round(agg.total),
					liveAmount: round(agg.live),
					recordingAmount: round(agg.recording),
					youtubeAmount: round(agg.youtube),
					otherAmount: round(agg.other),
					totalMinutes: agg.minutes,
					sessionCount: agg.count,
					netAmount: net,
					status: PayrollStatus.GENERATED,
					generatedAt: new Date(),
				};

				const payrollRecord = await ctx.db.payroll.upsert({
					where: key,
					create: {
						organizationId,
						teacherId,
						month: input.month,
						year: input.year,
						...data,
					},
					update: data,
					include: {
						teacher: { select: { fullName: true, teacherCode: true } },
						organization: { select: { name: true } },
					},
				});

				// Generate + upload payslip PDF to MinIO (best-effort, don't fail payroll on storage error)
				try {
					const { generatePayslipPdf } = await import(
						"@/server/services/payroll/generate-payslip-pdf"
					);
					const { uploadBuffer } = await import("@/server/storage/minio");
					const pdfBuffer = await generatePayslipPdf({
						teacherName: payrollRecord.teacher.fullName,
						teacherCode: payrollRecord.teacher.teacherCode,
						orgName: payrollRecord.organization.name,
						month: input.month,
						year: input.year,
						sessions: agg.count,
						minutes: agg.minutes,
						liveAmount: agg.live,
						recordingAmount: agg.recording,
						youtubeAmount: agg.youtube,
						otherAmount: agg.other,
						totalAmount: agg.total,
						status: "GENERATED",
					});
					const payslipKey = `payslips/${organizationId}/${input.year}/${input.month}/${teacherId}.pdf`;
					await uploadBuffer(payslipKey, pdfBuffer, "application/pdf");
					await ctx.db.payroll.update({
						where: { id: payrollRecord.id },
						data: { payslipKey },
					});
				} catch {
					// MinIO unavailable or PDF failed — continue without payslip
				}

				generated += 1;
			}

			await ctx.db.auditLog.create({
				data: {
					organizationId,
					userId: ctx.tenant.userId,
					action: "PAYROLL_GENERATED",
					entity: "Payroll",
					entityId: `${input.year}-${String(input.month).padStart(2, "0")}`,
					newValue: {
						month: input.month,
						year: input.year,
						generated,
						skippedPaid,
					},
				},
			});

			return { generated, skippedPaid };
		}),

	listPayrolls: tenantProcedure
		.input(
			z
				.object({
					month: z.number().int().min(1).max(12).optional(),
					year: z.number().int().min(2000).max(2100).optional(),
				})
				.optional(),
		)
		.query(({ ctx, input }) => {
			const filters = input ?? {};
			return ctx.db.payroll.findMany({
				where: {
					organizationId: ctx.tenant.organizationId,
					...(filters.month ? { month: filters.month } : {}),
					...(filters.year ? { year: filters.year } : {}),
				},
				include: {
					teacher: {
						select: {
							fullName: true,
							teacherCode: true,
							upiId: true,
							bankAccountNumber: true,
							bankIfsc: true,
							bankName: true,
							paymentQrCode: true,
						},
					},
				},
				orderBy: [
					{ year: "desc" },
					{ month: "desc" },
					{ teacher: { fullName: "asc" } },
				],
			});
		}),

	setPayrollStatus: tenantProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				status: z.nativeEnum(PayrollStatus),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.payroll.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				select: { id: true, status: true },
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Payroll not found.",
				});
			}

			const payroll = await ctx.db.payroll.update({
				where: { id: existing.id },
				data: {
					status: input.status,
					paidAt: input.status === PayrollStatus.PAID ? new Date() : null,
					// Clearing payment details when reverting away from PAID
					...(input.status !== PayrollStatus.PAID
						? { paymentMethod: null, paymentReference: null }
						: {}),
				},
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "PAYROLL_STATUS_CHANGED",
					entity: "Payroll",
					entityId: payroll.id,
					oldValue: { status: existing.status },
					newValue: { status: input.status },
				},
			});

			return payroll;
		}),

	// Mark a payroll as PAID with payment method + reference + date
	markPayrollPaid: tenantProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				paymentMethod: z.nativeEnum(PaymentMethod),
				paymentReference: z.string().max(120).optional(),
				paidAt: z.coerce.date().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (
				ctx.tenant.role !== Role.ORG_OWNER &&
				ctx.tenant.role !== Role.MANAGER
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only owners and managers can record payments.",
				});
			}
			const existing = await ctx.db.payroll.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				include: {
					teacher: { select: { fullName: true, teacherCode: true } },
					organization: { select: { name: true } },
				},
			});
			if (!existing)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Payroll not found.",
				});

			const payroll = await ctx.db.payroll.update({
				where: { id: existing.id },
				data: {
					status: PayrollStatus.PAID,
					paidAt: input.paidAt ?? new Date(),
					paymentMethod: input.paymentMethod,
					paymentReference: input.paymentReference || null,
				},
			});

			// Regenerate payslip with PAID status (best-effort)
			try {
				const { generatePayslipPdf } = await import(
					"@/server/services/payroll/generate-payslip-pdf"
				);
				const { uploadBuffer } = await import("@/server/storage/minio");
				const pdfBuffer = await generatePayslipPdf({
					teacherName: existing.teacher.fullName,
					teacherCode: existing.teacher.teacherCode,
					orgName: existing.organization.name,
					month: existing.month,
					year: existing.year,
					sessions: existing.sessionCount,
					minutes: existing.totalMinutes,
					liveAmount: Number(existing.liveAmount),
					recordingAmount: Number(existing.recordingAmount),
					youtubeAmount: Number(existing.youtubeAmount),
					otherAmount: Number(existing.otherAmount),
					totalAmount: Number(existing.totalAmount),
					bonusAmount: Number(existing.bonusAmount),
					deductionAmount: Number(existing.deductionAmount),
					tdsAmount: Number(existing.tdsAmount),
					netAmount: Number(existing.netAmount || existing.totalAmount),
					paymentMethod: input.paymentMethod,
					paymentReference: input.paymentReference ?? null,
					status: "PAID",
					paidAt: payroll.paidAt,
				});
				const payslipKey = `payslips/${ctx.tenant.organizationId}/${existing.year}/${existing.month}/${existing.teacherId}.pdf`;
				await uploadBuffer(payslipKey, pdfBuffer, "application/pdf");
				await ctx.db.payroll.update({
					where: { id: payroll.id },
					data: { payslipKey },
				});
			} catch {
				// storage unavailable — payment still recorded
			}

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "PAYROLL_PAID",
					entity: "Payroll",
					entityId: payroll.id,
					newValue: {
						paymentMethod: input.paymentMethod,
						paymentReference: input.paymentReference ?? null,
					},
				},
			});

			return payroll;
		}),

	// Apply bonus / deduction / TDS adjustments → recompute net
	updatePayrollAdjustments: tenantProcedure
		.input(
			z.object({
				id: z.string().cuid(),
				bonusAmount: z.number().min(0).max(10_000_000).default(0),
				deductionAmount: z.number().min(0).max(10_000_000).default(0),
				tdsAmount: z.number().min(0).max(10_000_000).default(0),
				adjustmentNote: z.string().max(300).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (
				ctx.tenant.role !== Role.ORG_OWNER &&
				ctx.tenant.role !== Role.MANAGER
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only owners and managers can adjust payroll.",
				});
			}
			const existing = await ctx.db.payroll.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				select: { id: true, status: true, totalAmount: true },
			});
			if (!existing)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Payroll not found.",
				});
			if (existing.status === PayrollStatus.PAID) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Cannot adjust a payroll that is already paid. Revert it first.",
				});
			}

			const total = Number(existing.totalAmount);
			const net = Number(
				(
					total +
					input.bonusAmount -
					input.deductionAmount -
					input.tdsAmount
				).toFixed(2),
			);

			const payroll = await ctx.db.payroll.update({
				where: { id: existing.id },
				data: {
					bonusAmount: input.bonusAmount,
					deductionAmount: input.deductionAmount,
					tdsAmount: input.tdsAmount,
					adjustmentNote: input.adjustmentNote || null,
					netAmount: net,
				},
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "PAYROLL_ADJUSTED",
					entity: "Payroll",
					entityId: payroll.id,
					newValue: {
						bonus: input.bonusAmount,
						deduction: input.deductionAmount,
						tds: input.tdsAmount,
						net,
					},
				},
			});

			return payroll;
		}),

	// Recalculate a single payroll from current approved sessions (preserves adjustments)
	recalculatePayroll: tenantProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.payroll.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
			});
			if (!existing)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Payroll not found.",
				});
			if (existing.status === PayrollStatus.PAID) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot recalculate a paid payroll. Revert it first.",
				});
			}

			const start = new Date(existing.year, existing.month - 1, 1);
			const end = new Date(existing.year, existing.month, 1);
			const sessions = await ctx.db.facultySession.findMany({
				where: {
					organizationId: ctx.tenant.organizationId,
					teacherId: existing.teacherId,
					date: { gte: start, lt: end },
					status: SessionStatus.APPROVED,
				},
				select: { sessionType: true, amount: true, durationMinutes: true },
			});

			const agg = {
				live: 0,
				recording: 0,
				youtube: 0,
				other: 0,
				total: 0,
				minutes: 0,
				count: 0,
			};
			for (const s of sessions) {
				const amount = Number(s.amount);
				agg.total += amount;
				agg.minutes += s.durationMinutes;
				agg.count += 1;
				if (s.sessionType === SessionType.LIVE_CLASS) agg.live += amount;
				else if (s.sessionType === SessionType.RECORDING)
					agg.recording += amount;
				else if (s.sessionType === SessionType.YOUTUBE) agg.youtube += amount;
				else agg.other += amount;
			}

			const round = (v: number) => Number(v.toFixed(2));
			const bonus = Number(existing.bonusAmount);
			const deduction = Number(existing.deductionAmount);
			const tds = Number(existing.tdsAmount);
			const net = round(agg.total + bonus - deduction - tds);

			const payroll = await ctx.db.payroll.update({
				where: { id: existing.id },
				data: {
					totalAmount: round(agg.total),
					liveAmount: round(agg.live),
					recordingAmount: round(agg.recording),
					youtubeAmount: round(agg.youtube),
					otherAmount: round(agg.other),
					totalMinutes: agg.minutes,
					sessionCount: agg.count,
					netAmount: net,
					status: PayrollStatus.GENERATED,
					generatedAt: new Date(),
				},
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: "PAYROLL_RECALCULATED",
					entity: "Payroll",
					entityId: payroll.id,
					newValue: { total: round(agg.total), sessions: agg.count, net },
				},
			});

			return payroll;
		}),

	recentAuditLogs: tenantProcedure.query(({ ctx }) => {
		return ctx.db.auditLog.findMany({
			where: { organizationId: ctx.tenant.organizationId },
			include: { user: { select: { name: true, email: true } } },
			orderBy: { createdAt: "desc" },
			take: 20,
		});
	}),

	// ─── Settings ────────────────────────────────────────────────────────────

	getOrgSettings: tenantProcedure.query(async ({ ctx }) => {
		const org = await ctx.db.organization.findUnique({
			where: { id: ctx.tenant.organizationId },
			include: { _count: { select: { users: true, teachers: true } } },
		});
		if (!org) throw new TRPCError({ code: "NOT_FOUND" });
		return {
			id: org.id,
			name: org.name,
			slug: org.slug,
			status: String(org.status),
			createdAt: org.createdAt,
			userCount: org._count.users,
			teacherCount: org._count.teachers,
		};
	}),

	updateOrgSettings: tenantProcedure
		.input(z.object({ name: z.string().min(2).max(100) }))
		.mutation(async ({ ctx, input }) => {
			if (
				ctx.tenant.role !== Role.ORG_OWNER &&
				ctx.tenant.role !== Role.MANAGER
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Only org owners and managers can update organization settings.",
				});
			}
			return ctx.db.organization.update({
				where: { id: ctx.tenant.organizationId },
				data: { name: input.name },
				select: { id: true, name: true, slug: true },
			});
		}),

	listMembers: tenantProcedure.query(async ({ ctx }) => {
		// Use UserOrganization as source of truth — not User.organizationId
		// (which is just the *active* org and changes when the user switches)
		const memberships = await ctx.db.userOrganization.findMany({
			where: { organizationId: ctx.tenant.organizationId },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
						createdAt: true,
					},
				},
			},
			orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
		});
		return memberships.map((m) => ({
			id: m.user.id,
			name: m.user.name,
			email: m.user.email,
			image: m.user.image,
			createdAt: m.user.createdAt,
			role: String(m.role),
			isCurrentUser: m.userId === ctx.tenant.userId,
		}));
	}),

	updateMemberRole: tenantProcedure
		.input(z.object({ userId: z.string(), role: z.nativeEnum(Role) }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.tenant.role !== Role.ORG_OWNER) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only org owners can change member roles.",
				});
			}
			if (input.userId === ctx.tenant.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot change your own role.",
				});
			}
			const membership = await ctx.db.userOrganization.findUnique({
				where: {
					userId_organizationId: {
						userId: input.userId,
						organizationId: ctx.tenant.organizationId,
					},
				},
			});
			if (!membership) throw new TRPCError({ code: "NOT_FOUND" });

			// Update membership role
			await ctx.db.userOrganization.update({
				where: {
					userId_organizationId: {
						userId: input.userId,
						organizationId: ctx.tenant.organizationId,
					},
				},
				data: { role: input.role },
			});

			// Also sync User.role if this is their currently active org
			await ctx.db.user.updateMany({
				where: { id: input.userId, organizationId: ctx.tenant.organizationId },
				data: { role: input.role },
			});

			return { ok: true };
		}),

	removeMember: tenantProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.tenant.role !== Role.ORG_OWNER) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only org owners can remove members.",
				});
			}
			if (input.userId === ctx.tenant.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot remove yourself.",
				});
			}
			const membership = await ctx.db.userOrganization.findUnique({
				where: {
					userId_organizationId: {
						userId: input.userId,
						organizationId: ctx.tenant.organizationId,
					},
				},
			});
			if (!membership) throw new TRPCError({ code: "NOT_FOUND" });

			// Remove from membership table
			await ctx.db.userOrganization.delete({
				where: {
					userId_organizationId: {
						userId: input.userId,
						organizationId: ctx.tenant.organizationId,
					},
				},
			});

			// If this was their active org, clear it so they land on org selection
			await ctx.db.user.updateMany({
				where: { id: input.userId, organizationId: ctx.tenant.organizationId },
				data: { organizationId: null },
			});

			return { ok: true };
		}),

	// ─── Member Invitations ───────────────────────────────────────────────────

	inviteMember: tenantProcedure
		.input(
			z.object({
				email: z.string().email(),
				role: z.enum(["MANAGER", "ORG_OWNER"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (
				ctx.tenant.role !== Role.ORG_OWNER &&
				ctx.tenant.role !== Role.MANAGER
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only org owners and managers can invite members.",
				});
			}
			// Check if already a member via UserOrganization (correct — not active org)
			const existing = await ctx.db.user.findUnique({
				where: { email: input.email },
				select: { id: true },
			});
			if (existing) {
				const alreadyMember = await ctx.db.userOrganization.findUnique({
					where: {
						userId_organizationId: {
							userId: existing.id,
							organizationId: ctx.tenant.organizationId,
						},
					},
				});
				if (alreadyMember) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "This person is already a member of the organization.",
					});
				}
			}
			// Expire any previous pending invite for same email in this org
			await ctx.db.orgInvite.updateMany({
				where: {
					organizationId: ctx.tenant.organizationId,
					email: input.email,
					acceptedAt: null,
				},
				data: { expiresAt: new Date(0) },
			});
			const token = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			await ctx.db.orgInvite.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					email: input.email,
					role: input.role as Role,
					token,
					invitedById: ctx.tenant.userId,
					expiresAt,
				},
			});
			const appUrl = process.env.APP_URL ?? "http://localhost:3000";
			return { inviteUrl: `${appUrl}/org-invite/${token}`, expiresAt };
		}),

	listPendingInvites: tenantProcedure.query(async ({ ctx }) => {
		return ctx.db.orgInvite.findMany({
			where: {
				organizationId: ctx.tenant.organizationId,
				acceptedAt: null,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				email: true,
				role: true,
				expiresAt: true,
				createdAt: true,
			},
		});
	}),

	cancelInvite: tenantProcedure
		.input(z.object({ inviteId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			if (
				ctx.tenant.role !== Role.ORG_OWNER &&
				ctx.tenant.role !== Role.MANAGER
			) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			const invite = await ctx.db.orgInvite.findFirst({
				where: {
					id: input.inviteId,
					organizationId: ctx.tenant.organizationId,
				},
			});
			if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
			await ctx.db.orgInvite.delete({ where: { id: input.inviteId } });
			return { ok: true };
		}),

	getProfile: tenantProcedure.query(async ({ ctx }) => {
		const user = await ctx.db.user.findUnique({
			where: { id: ctx.tenant.userId },
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				role: true,
				createdAt: true,
			},
		});
		if (!user) throw new TRPCError({ code: "NOT_FOUND" });
		return { ...user, role: String(user.role) };
	}),

	updateProfile: tenantProcedure
		.input(z.object({ name: z.string().min(2).max(100) }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.user.update({
				where: { id: ctx.tenant.userId },
				data: { name: input.name },
				select: { id: true, name: true, email: true },
			});
		}),

	// Upload avatar: accepts base64 data URI, stores in MinIO, updates Teacher.avatar
	uploadTeacherAvatar: tenantProcedure
		.input(z.object({ teacherId: z.string().cuid(), dataUrl: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const teacher = await ctx.db.teacher.findFirst({
				where: { id: input.teacherId, organizationId: orgId },
			});
			if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });

			const [header, b64] = input.dataUrl.split(",");
			const contentType = header?.match(/:(.*?);/)?.[1] ?? "image/jpeg";
			const buffer = Buffer.from(b64 ?? "", "base64");
			const ext = contentType.includes("png") ? "png" : "jpg";
			const key = `avatars/${orgId}/${input.teacherId}.${ext}`;

			if (teacher.avatar) {
				try {
					await deleteObject(teacher.avatar);
				} catch {
					/* ignore */
				}
			}

			await uploadBuffer(key, buffer, contentType);
			const url = await getPresignedUrl(key, 60 * 60 * 24 * 7); // 7 days

			await ctx.db.teacher.update({
				where: { id: input.teacherId },
				data: { avatar: key },
			});

			return { url };
		}),

	// Get a fresh presigned URL for a teacher avatar
	getTeacherAvatarUrl: tenantProcedure
		.input(z.object({ teacherId: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.findFirst({
				where: {
					id: input.teacherId,
					organizationId: ctx.tenant.organizationId,
				},
				select: { avatar: true },
			});
			if (!teacher?.avatar) return { url: null };
			const url = await getPresignedUrl(teacher.avatar, 60 * 60 * 24);
			return { url };
		}),

	getTeacherPaymentQrUrl: tenantProcedure
		.input(z.object({ teacherId: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.findFirst({
				where: {
					id: input.teacherId,
					organizationId: ctx.tenant.organizationId,
				},
				select: { paymentQrCode: true },
			});
			if (!teacher?.paymentQrCode) return { url: null };
			const url = await getPresignedUrl(teacher.paymentQrCode, 60 * 60 * 24);
			return { url };
		}),

	// Add/remove session attachment: accepts base64 data URI
	addSessionAttachment: tenantProcedure
		.input(
			z.object({
				sessionId: z.string().cuid(),
				fileName: z.string(),
				dataUrl: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const session = await ctx.db.facultySession.findFirst({
				where: { id: input.sessionId, organizationId: orgId },
			});
			if (!session) throw new TRPCError({ code: "NOT_FOUND" });

			const [header, b64] = input.dataUrl.split(",");
			const contentType =
				header?.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
			const buffer = Buffer.from(b64 ?? "", "base64");
			const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
			const key = `attachments/${orgId}/${input.sessionId}/${Date.now()}_${safeFileName}`;

			await uploadBuffer(key, buffer, contentType);

			await ctx.db.facultySession.update({
				where: { id: input.sessionId },
				data: { attachments: { push: key } },
			});

			return { key };
		}),

	removeSessionAttachment: tenantProcedure
		.input(z.object({ sessionId: z.string().cuid(), key: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const session = await ctx.db.facultySession.findFirst({
				where: { id: input.sessionId, organizationId: orgId },
			});
			if (!session) throw new TRPCError({ code: "NOT_FOUND" });

			try {
				await deleteObject(input.key);
			} catch {
				/* ignore */
			}

			const updated = session.attachments.filter((k) => k !== input.key);
			await ctx.db.facultySession.update({
				where: { id: input.sessionId },
				data: { attachments: updated },
			});

			return { ok: true };
		}),

	getAttachmentUrl: tenantProcedure
		.input(z.object({ key: z.string() }))
		.query(async ({ ctx: _ctx, input }) => {
			const url = await getPresignedUrl(input.key, 3600);
			return { url };
		}),

	// ─────────────────────────────────────────────────────────────────────────

	monthlyTrend: tenantProcedure.query(async ({ ctx }) => {
		const now = new Date();
		const months: { label: string; sessions: number; payout: number }[] = [];

		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			const start = new Date(d.getFullYear(), d.getMonth(), 1);
			const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);

			const agg = await ctx.db.facultySession.aggregate({
				where: {
					organizationId: ctx.tenant.organizationId,
					date: { gte: start, lt: end },
				},
				_count: { id: true },
				_sum: { amount: true },
			});

			months.push({
				label: d.toLocaleString("en-US", { month: "short" }),
				sessions: agg._count.id,
				payout: Number(agg._sum.amount ?? 0),
			});
		}

		return months;
	}),

	teacherReport: tenantProcedure
		.input(
			z.object({
				teacherId: z.string().cuid(),
				startDate: z.coerce.date(),
				endDate: z.coerce.date(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const teacher = await ctx.db.teacher.findFirst({
				where: { id: input.teacherId, organizationId: orgId },
				include: { payoutConfig: true },
			});
			if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });

			const sessions = await ctx.db.facultySession.findMany({
				where: {
					organizationId: orgId,
					teacherId: input.teacherId,
					date: { gte: input.startDate, lte: input.endDate },
				},
				orderBy: { date: "asc" },
			});

			const totals = sessions.reduce(
				(acc, s) => {
					acc.sessions += 1;
					acc.minutes += s.durationMinutes;
					acc.amount += Number(s.amount);
					return acc;
				},
				{ sessions: 0, minutes: 0, amount: 0 },
			);

			return {
				teacher: {
					id: teacher.id,
					fullName: teacher.fullName,
					teacherCode: teacher.teacherCode,
					roleTitle: teacher.roleTitle,
					email: teacher.email,
					mobile: teacher.mobile,
					specialization: teacher.specialization,
				},
				sessions: sessions.map((s) => ({
					id: s.id,
					title: s.title,
					sessionType: String(s.sessionType),
					date: s.date,
					durationMinutes: s.durationMinutes,
					amount: Number(s.amount),
					remarks: s.remarks,
				})),
				totals,
			};
		}),

	financeReport: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12),
				year: z.number().int().min(2020).max(2100),
				teacherId: z.string().cuid().optional(),
				sessionType: z.nativeEnum(SessionType).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const start = new Date(input.year, input.month - 1, 1);
			const end = new Date(input.year, input.month, 1);

			const sessions = await ctx.db.facultySession.findMany({
				where: {
					organizationId: orgId,
					date: { gte: start, lt: end },
					...(input.teacherId ? { teacherId: input.teacherId } : {}),
					...(input.sessionType ? { sessionType: input.sessionType } : {}),
				},
				include: { teacher: { select: { fullName: true, teacherCode: true } } },
				orderBy: [{ teacher: { fullName: "asc" } }, { date: "asc" }],
			});

			const byTeacher = new Map<
				string,
				{
					teacherName: string;
					teacherCode: string;
					sessions: number;
					minutes: number;
					live: number;
					recording: number;
					youtube: number;
					other: number;
					total: number;
				}
			>();

			for (const s of sessions) {
				const key = s.teacherId;
				const row = byTeacher.get(key) ?? {
					teacherName: s.teacher.fullName,
					teacherCode: s.teacher.teacherCode,
					sessions: 0,
					minutes: 0,
					live: 0,
					recording: 0,
					youtube: 0,
					other: 0,
					total: 0,
				};
				row.sessions += 1;
				row.minutes += s.durationMinutes;
				const amt = Number(s.amount);
				row.total += amt;
				if (s.sessionType === SessionType.LIVE_CLASS) row.live += amt;
				else if (s.sessionType === SessionType.RECORDING) row.recording += amt;
				else if (s.sessionType === SessionType.YOUTUBE) row.youtube += amt;
				else row.other += amt;
				byTeacher.set(key, row);
			}

			const rows = [...byTeacher.values()];
			const grandTotal = rows.reduce((a, r) => a + r.total, 0);
			const grandSessions = rows.reduce((a, r) => a + r.sessions, 0);
			const grandMinutes = rows.reduce((a, r) => a + r.minutes, 0);

			return {
				rows,
				totals: { grandTotal, grandSessions, grandMinutes },
				rawSessions: sessions.map((s) => ({
					id: s.id,
					title: s.title,
					teacherName: s.teacher.fullName,
					sessionType: String(s.sessionType),
					date: s.date,
					durationMinutes: s.durationMinutes,
					amount: Number(s.amount),
				})),
			};
		}),

	activityReport: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12),
				year: z.number().int().min(2020).max(2100),
			}),
		)
		.query(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const start = new Date(input.year, input.month - 1, 1);
			const end = new Date(input.year, input.month, 1);

			const teachers = await ctx.db.teacher.findMany({
				where: { organizationId: orgId, status: TeacherStatus.ACTIVE },
				include: {
					sessions: {
						where: { date: { gte: start, lt: end } },
					},
				},
				orderBy: { fullName: "asc" },
			});

			return teachers.map((t) => {
				const sessions = t.sessions.length;
				const minutes = t.sessions.reduce((a, s) => a + s.durationMinutes, 0);
				const amount = t.sessions.reduce((a, s) => a + Number(s.amount), 0);
				const byType: Record<string, number> = {};
				for (const s of t.sessions) {
					const k = String(s.sessionType);
					byType[k] = (byType[k] ?? 0) + 1;
				}
				return {
					teacherId: t.id,
					teacherCode: t.teacherCode,
					fullName: t.fullName,
					sessions,
					minutes,
					amount,
					byType,
				};
			});
		}),

	// Export a report as PDF to MinIO and return a presigned download URL
	exportReportPdf: tenantProcedure
		.input(
			z.object({
				type: z.enum(["finance", "activity", "teacher"]),
				month: z.number().int().min(1).max(12).optional(),
				year: z.number().int().min(2020).max(2100).optional(),
				teacherId: z.string().cuid().optional(),
				startDate: z.coerce.date().optional(),
				endDate: z.coerce.date().optional(),
				title: z.string(),
				headerLines: z.array(z.string()).optional(),
				// rows as JSON-serialised table: columns + body
				columns: z.array(z.string()),
				body: z.array(z.array(z.string())),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { default: jsPDF } = await import("jspdf");
			const autoTable = (await import("jspdf-autotable")).default;
			const doc = new jsPDF({ orientation: "landscape" });

			const org = await ctx.db.organization.findUnique({
				where: { id: ctx.tenant.organizationId },
				select: { name: true },
			});

			doc.setFontSize(16);
			doc.setFont("helvetica", "bold");
			doc.text(org?.name ?? "EasyLearning", 14, 18);
			doc.setFontSize(11);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(80);
			doc.text(input.title, 14, 26);
			doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 33);

			let tableStartY = 40;
			if (input.headerLines && input.headerLines.length > 0) {
				doc.setTextColor(55);
				input.headerLines.forEach((line, index) => {
					doc.text(line, 14, 40 + index * 7);
				});
				tableStartY = 48 + input.headerLines.length * 7;
			}

			doc.setTextColor(0);

			autoTable(doc, {
				head: [input.columns],
				body: input.body,
				startY: tableStartY,
				styles: { fontSize: 9 },
				headStyles: { fillColor: [30, 30, 30] },
			});

			const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
			const slug = input.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
			const ts = Date.now();
			const key = `reports/${ctx.tenant.organizationId}/${input.type}/${ts}_${slug}.pdf`;

			await uploadBuffer(key, pdfBuffer, "application/pdf");
			const url = await getPresignedUrl(key, 3600);
			return { url, key };
		}),

	// Professional Finance Report PDF (Claude theme, full teacher details)
	exportFinanceReportPdf: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12),
				year: z.number().int().min(2020).max(2100),
				teacherId: z.string().cuid().optional(),
				sessionType: z.nativeEnum(SessionType).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const start = new Date(input.year, input.month - 1, 1);
			const end = new Date(input.year, input.month, 1);

			const [org, sessions] = await Promise.all([
				ctx.db.organization.findUnique({
					where: { id: orgId },
					select: { name: true },
				}),
				ctx.db.facultySession.findMany({
					where: {
						organizationId: orgId,
						date: { gte: start, lt: end },
						...(input.teacherId ? { teacherId: input.teacherId } : {}),
						...(input.sessionType ? { sessionType: input.sessionType } : {}),
					},
					include: {
						teacher: {
							select: {
								fullName: true,
								teacherCode: true,
								memberType: true,
								email: true,
								mobile: true,
								upiId: true,
								bankName: true,
								bankAccountNumber: true,
								bankIfsc: true,
								roleTitle: true,
							},
						},
					},
					orderBy: [{ teacher: { fullName: "asc" } }, { date: "asc" }],
				}),
			]);

			// Aggregate by teacher
			const byTeacher = new Map<
				string,
				{
					teacherName: string;
					teacherCode: string;
					memberType: string;
					email: string | null;
					mobile: string | null;
					roleTitle: string | null;
					upiId: string | null;
					bankName: string | null;
					bankAccountNumber: string | null;
					bankIfsc: string | null;
					sessions: number;
					minutes: number;
					live: number;
					recording: number;
					youtube: number;
					other: number;
					total: number;
				}
			>();

			for (const s of sessions) {
				const key = s.teacherId;
				const t = s.teacher;
				const row = byTeacher.get(key) ?? {
					teacherName: t.fullName,
					teacherCode: t.teacherCode,
					memberType: String(t.memberType),
					email: t.email,
					mobile: t.mobile,
					roleTitle: t.roleTitle,
					upiId: t.upiId,
					bankName: t.bankName,
					bankAccountNumber: t.bankAccountNumber,
					bankIfsc: t.bankIfsc,
					sessions: 0,
					minutes: 0,
					live: 0,
					recording: 0,
					youtube: 0,
					other: 0,
					total: 0,
				};
				row.sessions += 1;
				row.minutes += s.durationMinutes;
				const amt = Number(s.amount);
				row.total += amt;
				if (s.sessionType === SessionType.LIVE_CLASS) row.live += amt;
				else if (s.sessionType === SessionType.RECORDING) row.recording += amt;
				else if (s.sessionType === SessionType.YOUTUBE) row.youtube += amt;
				else row.other += amt;
				byTeacher.set(key, row);
			}

			const rows = [...byTeacher.values()];
			const grandTotal = rows.reduce((a, r) => a + r.total, 0);
			const grandSessions = rows.reduce((a, r) => a + r.sessions, 0);
			const grandMinutes = rows.reduce((a, r) => a + r.minutes, 0);

			// ─── PDF Generation ──────────────────────────────────────────────────

			const { default: jsPDF } = await import("jspdf");
			const autoTable = (await import("jspdf-autotable")).default;

			const MONTHS_LIST = [
				"January", "February", "March", "April", "May", "June",
				"July", "August", "September", "October", "November", "December",
			];

			// Claude theme palette
			const C = {
				headerBg: [26, 26, 26] as [number, number, number],
				accent: [218, 119, 86] as [number, number, number],  // Claude orange
				accentLight: [246, 237, 229] as [number, number, number],
				tableHeaderBg: [40, 40, 40] as [number, number, number],
				altRowBg: [252, 249, 246] as [number, number, number],
				white: [255, 255, 255] as [number, number, number],
				text: [30, 30, 30] as [number, number, number],
				muted: [120, 115, 108] as [number, number, number],
				border: [220, 215, 208] as [number, number, number],
				totalRowBg: [218, 119, 86] as [number, number, number],
			};

			const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
			const pageW = doc.internal.pageSize.getWidth();
			const orgName = org?.name ?? "Organization";
			const monthLabel = MONTHS_LIST[input.month - 1] ?? String(input.month);
			const periodLabel = `${monthLabel} ${input.year}`;
			const generatedDate = new Date().toLocaleDateString("en-IN", {
				day: "2-digit", month: "long", year: "numeric",
			});

			// ── Header Band ──────────────────────────────────────────────────────
			doc.setFillColor(...C.headerBg);
			doc.rect(0, 0, pageW, 32, "F");

			// Accent left stripe
			doc.setFillColor(...C.accent);
			doc.rect(0, 0, 5, 32, "F");

			// Org name
			doc.setFont("helvetica", "bold");
			doc.setFontSize(18);
			doc.setTextColor(...C.white);
			doc.text(orgName, 12, 13);

			// Report title
			doc.setFontSize(10);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(200, 195, 190);
			doc.text("FINANCE REPORT", 12, 21);

			// Period (right-aligned)
			doc.setFont("helvetica", "bold");
			doc.setFontSize(14);
			doc.setTextColor(...C.white);
			doc.text(periodLabel, pageW - 14, 13, { align: "right" });
			doc.setFontSize(9);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(180, 175, 170);
			doc.text(`Generated: ${generatedDate}`, pageW - 14, 21, { align: "right" });

			// ── Summary Stats Bar ────────────────────────────────────────────────
			const statsY = 38;
			const statW = (pageW - 28) / 3;
			const fmtCurrency = (v: number) =>
				`Rs. ${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
			const fmtDuration = (m: number) =>
				`${Math.floor(m / 60)}h ${m % 60}m`;

			const stats = [
				{ label: "Total Sessions", value: String(grandSessions), icon: "sessions" },
				{ label: "Total Hours", value: fmtDuration(grandMinutes), icon: "hours" },
				{ label: "Total Payout", value: fmtCurrency(grandTotal), icon: "payout" },
			];

			stats.forEach((stat, i) => {
				const x = 14 + i * (statW + 0);
				doc.setFillColor(...C.accentLight);
				doc.roundedRect(x, statsY, statW - 2, 18, 2, 2, "F");
				doc.setDrawColor(...C.accent);
				doc.setLineWidth(0.5);
				doc.roundedRect(x, statsY, statW - 2, 18, 2, 2, "D");

				// Accent left border on card
				doc.setFillColor(...C.accent);
				doc.rect(x, statsY, 2.5, 18, "F");

				doc.setFont("helvetica", "normal");
				doc.setFontSize(7.5);
				doc.setTextColor(...C.muted);
				doc.text(stat.label.toUpperCase(), x + 6, statsY + 6);

				doc.setFont("helvetica", "bold");
				doc.setFontSize(i === 2 ? 10 : 13);
				doc.setTextColor(...C.text);
				doc.text(stat.value, x + 6, statsY + 13);
			});

			// ── Table ────────────────────────────────────────────────────────────
			const tableY = statsY + 24;

			const fmt = (v: number) =>
				v > 0 ? `Rs. ${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";

			const tableBody = rows.map((r) => {
				// Build teacher cell content
				const typeLabel = r.memberType === "FREELANCER" ? "Freelancer" : "Teacher";
				const paymentMode = r.upiId
					? `UPI: ${r.upiId}`
					: r.bankAccountNumber
						? `Bank: ${r.bankName ?? ""}\nA/c: ${r.bankAccountNumber}${r.bankIfsc ? `\nIFSC: ${r.bankIfsc}` : ""}`
						: "—";

				return [
					`${r.teacherName}\n[${r.teacherCode}] ${typeLabel}${r.roleTitle ? `\n${r.roleTitle}` : ""}${r.email ? `\n${r.email}` : ""}${r.mobile ? `\nMob: ${r.mobile}` : ""}`,
					paymentMode,
					String(r.sessions),
					fmtDuration(r.minutes),
					fmt(r.live),
					fmt(r.recording),
					fmt(r.youtube),
					fmt(r.other),
					fmtCurrency(r.total),
				];
			});

			// Grand total row
			tableBody.push([
				"GRAND TOTAL",
				"",
				String(grandSessions),
				fmtDuration(grandMinutes),
				"",
				"",
				"",
				"",
				fmtCurrency(grandTotal),
			]);

			autoTable(doc, {
				head: [["Teacher", "Payment Mode", "Sessions", "Duration", "Live (Rs.)", "Recording (Rs.)", "YouTube (Rs.)", "Other (Rs.)", "Total (Rs.)"]],
				body: tableBody,
				startY: tableY,
				margin: { left: 14, right: 14 },
				styles: {
					fontSize: 8,
					cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
					textColor: C.text,
					lineColor: C.border,
					lineWidth: 0.2,
					valign: "top",
					overflow: "linebreak",
				},
				headStyles: {
					fillColor: C.tableHeaderBg,
					textColor: C.white,
					fontStyle: "bold",
					fontSize: 8,
					halign: "center",
				},
				columnStyles: {
					0: { cellWidth: 52, fontStyle: "bold" },
					1: { cellWidth: 42, fontStyle: "normal", textColor: C.muted },
					2: { cellWidth: 18, halign: "center" },
					3: { cellWidth: 18, halign: "center" },
					4: { cellWidth: "auto", halign: "right" },
					5: { cellWidth: "auto", halign: "right" },
					6: { cellWidth: "auto", halign: "right" },
					7: { cellWidth: "auto", halign: "right" },
					8: { cellWidth: 32, halign: "right", fontStyle: "bold" },
				},
				alternateRowStyles: {
					fillColor: C.altRowBg,
				},
				didParseCell: (data) => {
					const isLastRow = data.row.index === tableBody.length - 1;
					if (isLastRow) {
						data.cell.styles.fillColor = C.totalRowBg;
						data.cell.styles.textColor = C.white;
						data.cell.styles.fontStyle = "bold";
					}
					// Bold teacher name (first line of col 0)
					if (data.column.index === 0 && !isLastRow) {
						data.cell.styles.fontStyle = "bold";
					}
				},
			});

			// ── Footer ────────────────────────────────────────────────────────────
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const pageCount = (doc.internal as any).getNumberOfPages() as number;
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				const footerY = doc.internal.pageSize.getHeight() - 6;
				doc.setFillColor(...C.headerBg);
				doc.rect(0, footerY - 4, pageW, 14, "F");
				doc.setFont("helvetica", "normal");
				doc.setFontSize(7);
				doc.setTextColor(150, 145, 140);
				doc.text(`${orgName} · Finance Report · ${periodLabel}`, 14, footerY);
				doc.text(`Page ${i} of ${pageCount}`, pageW - 14, footerY, { align: "right" });
			}

			const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
			const ts = Date.now();
			const key = `reports/${orgId}/finance/${ts}_finance_${input.year}_${input.month}.pdf`;

			await uploadBuffer(key, pdfBuffer, "application/pdf");
			const url = await getPresignedUrl(key, 3600);
			return { url, key };
		}),

	// Professional Teacher Report PDF (Claude theme, per-session detail)
	exportTeacherReportPdf: tenantProcedure
		.input(
			z.object({
				teacherId: z.string().cuid(),
				startDate: z.coerce.date(),
				endDate: z.coerce.date(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;

			const [org, teacher, sessions] = await Promise.all([
				ctx.db.organization.findUnique({
					where: { id: orgId },
					select: { name: true },
				}),
				ctx.db.teacher.findFirst({
					where: { id: input.teacherId, organizationId: orgId },
					select: {
						fullName: true,
						teacherCode: true,
						memberType: true,
						roleTitle: true,
						email: true,
						mobile: true,
						specialization: true,
						upiId: true,
						bankName: true,
						bankAccountNumber: true,
						bankIfsc: true,
						panNumber: true,
					},
				}),
				ctx.db.facultySession.findMany({
					where: {
						organizationId: orgId,
						teacherId: input.teacherId,
						date: { gte: input.startDate, lte: input.endDate },
					},
					orderBy: { date: "asc" },
				}),
			]);

			if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });

			const grandMinutes = sessions.reduce((a, s) => a + s.durationMinutes, 0);
			const grandTotal = sessions.reduce((a, s) => a + Number(s.amount), 0);
			const byType: Record<string, { sessions: number; amount: number }> = {};
			for (const s of sessions) {
				const k = String(s.sessionType);
				byType[k] ??= { sessions: 0, amount: 0 };
				byType[k]!.sessions += 1;
				byType[k]!.amount += Number(s.amount);
			}

			const { default: jsPDF } = await import("jspdf");
			const autoTable = (await import("jspdf-autotable")).default;

			const C = {
				headerBg: [26, 26, 26] as [number, number, number],
				accent: [218, 119, 86] as [number, number, number],
				accentLight: [246, 237, 229] as [number, number, number],
				tableHeaderBg: [40, 40, 40] as [number, number, number],
				altRowBg: [252, 249, 246] as [number, number, number],
				white: [255, 255, 255] as [number, number, number],
				text: [30, 30, 30] as [number, number, number],
				muted: [120, 115, 108] as [number, number, number],
				border: [220, 215, 208] as [number, number, number],
				totalRowBg: [218, 119, 86] as [number, number, number],
				cardBg: [250, 248, 245] as [number, number, number],
			};

			const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
			const pageW = doc.internal.pageSize.getWidth();
			const orgName = org?.name ?? "Organization";
			const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
			const periodLabel = `${fmtDate(input.startDate)} – ${fmtDate(input.endDate)}`;
			const generatedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
			const fmtCurrency = (v: number) => `Rs. ${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
			const fmtDuration = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
			const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");

			// ── Header Band ──────────────────────────────────────────────────────
			doc.setFillColor(...C.headerBg);
			doc.rect(0, 0, pageW, 32, "F");
			doc.setFillColor(...C.accent);
			doc.rect(0, 0, 5, 32, "F");

			doc.setFont("helvetica", "bold");
			doc.setFontSize(18);
			doc.setTextColor(...C.white);
			doc.text(orgName, 12, 13);

			doc.setFontSize(10);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(200, 195, 190);
			doc.text("TEACHER REPORT", 12, 21);

			// Teacher name + period (right side)
			doc.setFont("helvetica", "bold");
			doc.setFontSize(13);
			doc.setTextColor(...C.white);
			doc.text(teacher.fullName, pageW - 14, 13, { align: "right" });
			doc.setFontSize(9);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(180, 175, 170);
			doc.text(periodLabel, pageW - 14, 21, { align: "right" });
			doc.text(`Generated: ${generatedDate}`, pageW - 14, 28, { align: "right" });

			// ── Teacher Profile Card ──────────────────────────────────────────────
			const cardY = 37;
			const cardH = 30;
			doc.setFillColor(...C.cardBg);
			doc.roundedRect(14, cardY, pageW - 28, cardH, 2, 2, "F");
			doc.setDrawColor(...C.border);
			doc.setLineWidth(0.3);
			doc.roundedRect(14, cardY, pageW - 28, cardH, 2, 2, "D");
			// Left accent bar
			doc.setFillColor(...C.accent);
			doc.roundedRect(14, cardY, 3, cardH, 1, 1, "F");

			// Column 1: Identity
			const col1X = 22;
			doc.setFont("helvetica", "bold");
			doc.setFontSize(11);
			doc.setTextColor(...C.text);
			doc.text(teacher.fullName, col1X, cardY + 8);

			doc.setFont("helvetica", "normal");
			doc.setFontSize(8);
			doc.setTextColor(...C.muted);
			const memberTypeStr = teacher.memberType === "FREELANCER" ? "Freelancer" : "Teacher";
			doc.text(`[${teacher.teacherCode}]  ${memberTypeStr}${teacher.roleTitle ? `  ·  ${teacher.roleTitle}` : ""}`, col1X, cardY + 14);
			if (teacher.specialization) doc.text(`Specialization: ${teacher.specialization}`, col1X, cardY + 20);
			if (teacher.panNumber) doc.text(`PAN: ${teacher.panNumber}`, col1X, cardY + 26);

			// Column 2: Contact
			const col2X = pageW * 0.38;
			doc.setFont("helvetica", "bold");
			doc.setFontSize(7.5);
			doc.setTextColor(...C.accent);
			doc.text("CONTACT", col2X, cardY + 8);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(...C.text);
			doc.setFontSize(8.5);
			if (teacher.email) doc.text(teacher.email, col2X, cardY + 14);
			if (teacher.mobile) doc.text(`Mob: ${teacher.mobile}`, col2X, cardY + 20);

			// Column 3: Payment
			const col3X = pageW * 0.62;
			doc.setFont("helvetica", "bold");
			doc.setFontSize(7.5);
			doc.setTextColor(...C.accent);
			doc.text("PAYMENT MODE", col3X, cardY + 8);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(...C.text);
			doc.setFontSize(8.5);
			if (teacher.upiId) {
				doc.text(`UPI: ${teacher.upiId}`, col3X, cardY + 14);
			} else if (teacher.bankAccountNumber) {
				doc.text(`Bank: ${teacher.bankName ?? ""}`, col3X, cardY + 14);
				doc.text(`A/c: ${teacher.bankAccountNumber}`, col3X, cardY + 20);
				if (teacher.bankIfsc) doc.text(`IFSC: ${teacher.bankIfsc}`, col3X, cardY + 26);
			} else {
				doc.setTextColor(...C.muted);
				doc.text("Not specified", col3X, cardY + 14);
			}

			// ── Summary Stats ────────────────────────────────────────────────────
			const statsY = cardY + cardH + 5;
			const statW = (pageW - 28) / 3;

			const stats = [
				{ label: "Total Sessions", value: String(sessions.length) },
				{ label: "Total Duration", value: fmtDuration(grandMinutes) },
				{ label: "Total Payout", value: fmtCurrency(grandTotal) },
			];

			stats.forEach((stat, i) => {
				const x = 14 + i * (statW + 0);
				doc.setFillColor(...C.accentLight);
				doc.roundedRect(x, statsY, statW - 2, 14, 2, 2, "F");
				doc.setDrawColor(...C.accent);
				doc.setLineWidth(0.5);
				doc.roundedRect(x, statsY, statW - 2, 14, 2, 2, "D");
				doc.setFillColor(...C.accent);
				doc.rect(x, statsY, 2.5, 14, "F");

				doc.setFont("helvetica", "normal");
				doc.setFontSize(7);
				doc.setTextColor(...C.muted);
				doc.text(stat.label.toUpperCase(), x + 6, statsY + 5);
				doc.setFont("helvetica", "bold");
				doc.setFontSize(i === 2 ? 9 : 11);
				doc.setTextColor(...C.text);
				doc.text(stat.value, x + 6, statsY + 11);
			});

			// ── Sessions Table ───────────────────────────────────────────────────
			const tableY = statsY + 19;

			const tableBody = sessions.map((s) => [
				fmtDate(s.date),
				s.title,
				typeLabel(String(s.sessionType)),
				fmtDuration(s.durationMinutes),
				fmtCurrency(Number(s.amount)),
				s.remarks ?? "—",
			]);

			// Totals row
			tableBody.push([
				"TOTAL",
				`${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
				"",
				fmtDuration(grandMinutes),
				fmtCurrency(grandTotal),
				"",
			]);

			autoTable(doc, {
				head: [["Date", "Session Title", "Type", "Duration", "Amount (Rs.)", "Remarks"]],
				body: tableBody,
				startY: tableY,
				margin: { left: 14, right: 14 },
				styles: {
					fontSize: 8,
					cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
					textColor: C.text,
					lineColor: C.border,
					lineWidth: 0.2,
					valign: "middle",
					overflow: "linebreak",
				},
				headStyles: {
					fillColor: C.tableHeaderBg,
					textColor: C.white,
					fontStyle: "bold",
					fontSize: 8,
				},
				columnStyles: {
					0: { cellWidth: 28, halign: "center" },
					1: { cellWidth: "auto", fontStyle: "bold" },
					2: { cellWidth: 26, halign: "center" },
					3: { cellWidth: 22, halign: "center" },
					4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
					5: { cellWidth: 50, textColor: C.muted },
				},
				alternateRowStyles: { fillColor: C.altRowBg },
				didParseCell: (data) => {
					const isLastRow = data.row.index === tableBody.length - 1;
					if (isLastRow) {
						data.cell.styles.fillColor = C.totalRowBg;
						data.cell.styles.textColor = C.white;
						data.cell.styles.fontStyle = "bold";
					}
				},
			});

			// ── Footer ───────────────────────────────────────────────────────────
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const pageCount = (doc.internal as any).getNumberOfPages() as number;
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				const footerY = doc.internal.pageSize.getHeight() - 6;
				doc.setFillColor(...C.headerBg);
				doc.rect(0, footerY - 4, pageW, 14, "F");
				doc.setFont("helvetica", "normal");
				doc.setFontSize(7);
				doc.setTextColor(150, 145, 140);
				doc.text(`${orgName} · Teacher Report · ${teacher.fullName} · ${periodLabel}`, 14, footerY);
				doc.text(`Page ${i} of ${pageCount}`, pageW - 14, footerY, { align: "right" });
			}

			const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
			const ts = Date.now();
			const safeName = teacher.fullName.replace(/[^a-zA-Z0-9]/g, "_");
			const key = `reports/${orgId}/teacher/${ts}_${safeName}.pdf`;

			await uploadBuffer(key, pdfBuffer, "application/pdf");
			const url = await getPresignedUrl(key, 3600);
			return { url, key };
		}),

	// ─── Multi-Org ───────────────────────────────────────────────────────────

	listMyOrganizations: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await ctx.db.userOrganization.findMany({
			where: { userId: ctx.session.user.id },
			include: {
				organization: {
					select: { id: true, name: true, slug: true, status: true },
				},
			},
			orderBy: { joinedAt: "asc" },
		});
		const activeUser = await ctx.db.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { organizationId: true },
		});
		return memberships.map((m) => ({
			...m.organization,
			role: String(m.role),
			isActive: m.organizationId === activeUser?.organizationId,
		}));
	}),

	createOrganization: protectedProcedure
		.input(z.object({ name: z.string().min(2).max(100) }))
		.mutation(async ({ ctx, input }) => {
			const slug = `${input.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.slice(0, 24)}-${ctx.session.user.id.slice(0, 6)}`;
			const org = await ctx.db.organization.create({
				data: {
					name: input.name,
					slug,
					ownerId: ctx.session.user.id,
				},
			});
			// Add creator as ORG_OWNER in membership table
			await ctx.db.userOrganization.create({
				data: {
					userId: ctx.session.user.id,
					organizationId: org.id,
					role: Role.ORG_OWNER,
				},
			});
			// Switch active org to the new one
			await ctx.db.user.update({
				where: { id: ctx.session.user.id },
				data: { organizationId: org.id, role: Role.ORG_OWNER },
			});
			return org;
		}),

	switchOrganization: protectedProcedure
		.input(z.object({ organizationId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const membership = await ctx.db.userOrganization.findUnique({
				where: {
					userId_organizationId: {
						userId: ctx.session.user.id,
						organizationId: input.organizationId,
					},
				},
			});
			if (!membership)
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not a member of that organization.",
				});
			await ctx.db.user.update({
				where: { id: ctx.session.user.id },
				data: { organizationId: input.organizationId, role: membership.role },
			});
			return { organizationId: input.organizationId };
		}),

	// ─── Teacher Portal ───────────────────────────────────────────────────────

	generateTeacherInvite: tenantProcedure
		.input(z.object({ teacherId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			if (
				ctx.tenant.role !== Role.ORG_OWNER &&
				ctx.tenant.role !== Role.MANAGER
			) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			const teacher = await ctx.db.teacher.findFirst({
				where: {
					id: input.teacherId,
					organizationId: ctx.tenant.organizationId,
				},
			});
			if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });

			const token = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
			await ctx.db.teacher.update({
				where: { id: teacher.id },
				data: {
					inviteToken: token,
					inviteExpiresAt: expiresAt,
					inviteEmail: teacher.email,
				},
			});
			const appUrl = process.env.APP_URL ?? "http://localhost:3000";
			return { inviteUrl: `${appUrl}/invite/${token}`, expiresAt };
		}),

	// Teacher reading their own data (role = TEACHER, userId set on teacher record)
	myTeacherProfile: tenantProcedure.query(async ({ ctx }) => {
		const teacher = await ctx.db.teacher.findFirst({
			where: {
				userId: ctx.tenant.userId,
				organizationId: ctx.tenant.organizationId,
			},
			include: { payoutConfig: true, organization: { select: { name: true } } },
		});
		if (!teacher)
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Teacher profile not found.",
			});
		return {
			...teacher,
			payoutConfig: teacher.payoutConfig
				? {
						liveRate: Number(teacher.payoutConfig.liveRate),
						recordingRate: Number(teacher.payoutConfig.recordingRate),
						youtubeRate: Number(teacher.payoutConfig.youtubeRate),
						doubtRate: Number(teacher.payoutConfig.doubtRate ?? 0),
						webinarRate: Number(teacher.payoutConfig.webinarRate ?? 0),
					}
				: null,
		};
	}),

	mySessions: tenantProcedure
		.input(
			z.object({
				month: z.number().int().min(1).max(12).optional(),
				year: z.number().int().min(2020).max(2100).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.findFirst({
				where: {
					userId: ctx.tenant.userId,
					organizationId: ctx.tenant.organizationId,
				},
			});
			if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });
			const now = new Date();
			const month = input.month ?? now.getMonth() + 1;
			const year = input.year ?? now.getFullYear();
			const start = new Date(year, month - 1, 1);
			const end = new Date(year, month, 1);
			const sessions = await ctx.db.facultySession.findMany({
				where: { teacherId: teacher.id, date: { gte: start, lt: end } },
				orderBy: { date: "desc" },
			});
			return sessions.map((s) => ({
				...s,
				sessionType: String(s.sessionType),
				amount: Number(s.amount),
			}));
		}),

	myPayslips: tenantProcedure.query(async ({ ctx }) => {
		const teacher = await ctx.db.teacher.findFirst({
			where: {
				userId: ctx.tenant.userId,
				organizationId: ctx.tenant.organizationId,
			},
		});
		if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });
		const payrolls = await ctx.db.payroll.findMany({
			where: { teacherId: teacher.id },
			orderBy: [{ year: "desc" }, { month: "desc" }],
		});
		return payrolls.map((p) => ({
			...p,
			status: String(p.status),
			totalAmount: Number(p.totalAmount),
			liveAmount: Number(p.liveAmount),
			recordingAmount: Number(p.recordingAmount),
			youtubeAmount: Number(p.youtubeAmount),
			otherAmount: Number(p.otherAmount),
			bonusAmount: Number(p.bonusAmount),
			deductionAmount: Number(p.deductionAmount),
			tdsAmount: Number(p.tdsAmount),
			netAmount: Number(p.netAmount || p.totalAmount),
			paymentMethod: p.paymentMethod ? String(p.paymentMethod) : null,
			paymentReference: p.paymentReference,
		}));
	}),

	getPayslipDownloadUrl: tenantProcedure
		.input(z.object({ payrollId: z.string().cuid() }))
		.query(async ({ ctx, input }) => {
			const payroll = await ctx.db.payroll.findFirst({
				where: {
					id: input.payrollId,
					organizationId: ctx.tenant.organizationId,
				},
			});
			if (!payroll?.payslipKey)
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Payslip PDF not yet generated.",
				});
			const { getPresignedUrl } = await import("@/server/storage/minio");
			const url = await getPresignedUrl(payroll.payslipKey, 3600);
			return { url, expiresIn: 3600 };
		}),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type OverviewSession = {
	teacher?: { fullName: string };
	sessionType: SessionType | string;
	durationMinutes: number;
	amount: unknown;
	title: string;
	date: Date;
};

function buildOverview({
	organization,
	sessions,
	totalTeachers,
	totalMinutes,
	totalPayout,
}: {
	organization: { name: string; slug: string; status: string };
	sessions: OverviewSession[];
	totalTeachers: number;
	totalMinutes: number;
	totalPayout: number;
}) {
	const distribution = sessions.reduce(
		(acc, session) => {
			const key = String(session.sessionType);
			acc[key] = (acc[key] ?? 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const teacherMap = new Map<
		string,
		{ name: string; hours: number; earnings: number; sessions: number }
	>();

	for (const session of sessions) {
		const name = session.teacher?.fullName ?? "Unassigned";
		const row = teacherMap.get(name) ?? {
			name,
			hours: 0,
			earnings: 0,
			sessions: 0,
		};
		row.hours += session.durationMinutes / 60;
		row.earnings += Number(session.amount);
		row.sessions += 1;
		teacherMap.set(name, row);
	}

	return {
		organization,
		stats: {
			totalTeachers,
			totalClasses: sessions.length,
			totalHours: Number((totalMinutes / 60).toFixed(1)),
			totalPayout: Number(totalPayout.toFixed(2)),
		},
		distribution,
		topTeachers: [...teacherMap.values()]
			.sort((a, b) => b.earnings - a.earnings)
			.slice(0, 5)
			.map((teacher) => ({
				...teacher,
				hours: Number(teacher.hours.toFixed(1)),
				earnings: Number(teacher.earnings.toFixed(2)),
			})),
		recentSessions: sessions.slice(0, 6).map((session) => ({
			title: session.title,
			teacherName: session.teacher?.fullName ?? "Unassigned",
			sessionType: String(session.sessionType),
			date: session.date,
			durationMinutes: session.durationMinutes,
			amount: Number(session.amount),
		})),
	};
}
