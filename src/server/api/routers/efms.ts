import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, tenantProcedure } from "@/server/api/trpc";
import {
	calculateDurationMinutes,
	calculatePayoutAmount,
} from "@/server/services/payroll/calculate-payout";
import { uploadBuffer, getPresignedUrl, deleteObject } from "@/server/storage/minio";
import {
	PaymentMethod,
	PayrollStatus,
	Role,
	SessionStatus,
	SessionType,
	TeacherStatus,
} from "../../../../generated/prisma";

const money = z.number().nonnegative().max(1_000_000);

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
		.input(
			z.object({
				teacherCode: z.string().min(2).max(24),
				fullName: z.string().min(2).max(120),
				email: z.string().email().optional(),
				mobile: z.string().min(8).max(20).optional(),
				specialization: z.string().max(80).optional(),
				bankAccountNumber: z.string().max(40).optional(),
				bankIfsc: z.string().max(20).optional(),
				bankName: z.string().max(80).optional(),
				panNumber: z.string().max(20).optional(),
				liveRate: money,
				recordingRate: money,
				youtubeRate: money,
				doubtRate: money.optional(),
				webinarRate: money.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					teacherCode: input.teacherCode,
					fullName: input.fullName,
					email: input.email,
					mobile: input.mobile,
					specialization: input.specialization,
					bankAccountNumber: input.bankAccountNumber,
					bankIfsc: input.bankIfsc,
					bankName: input.bankName,
					panNumber: input.panNumber,
					payoutConfig: {
						create: {
							liveRate: input.liveRate,
							recordingRate: input.recordingRate,
							youtubeRate: input.youtubeRate,
							doubtRate: input.doubtRate,
							webinarRate: input.webinarRate,
						},
					},
				},
			});

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
		.input(
			z.object({
				id: z.string().cuid(),
				teacherCode: z.string().min(2).max(24),
				fullName: z.string().min(2).max(120),
				email: z.string().email().optional().or(z.literal("")),
				mobile: z.string().min(8).max(20).optional().or(z.literal("")),
				specialization: z.string().max(80).optional().or(z.literal("")),
				bankAccountNumber: z.string().max(40).optional().or(z.literal("")),
				bankIfsc: z.string().max(20).optional().or(z.literal("")),
				bankName: z.string().max(80).optional().or(z.literal("")),
				panNumber: z.string().max(20).optional().or(z.literal("")),
				status: z.nativeEnum(TeacherStatus),
				liveRate: money,
				recordingRate: money,
				youtubeRate: money,
				doubtRate: money.optional(),
				webinarRate: money.optional(),
			}),
		)
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
				recordingRate: input.recordingRate,
				youtubeRate: input.youtubeRate,
				doubtRate: input.doubtRate,
				webinarRate: input.webinarRate,
			};

			const teacher = await ctx.db.teacher.update({
				where: { id: existing.id },
				data: {
					teacherCode: input.teacherCode,
					fullName: input.fullName,
					email: input.email || null,
					mobile: input.mobile || null,
					specialization: input.specialization || null,
					bankAccountNumber: input.bankAccountNumber || null,
					bankIfsc: input.bankIfsc || null,
					bankName: input.bankName || null,
					panNumber: input.panNumber || null,
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
		.input(
			z.object({
				teacherId: z.string().cuid(),
				sessionType: z.nativeEnum(SessionType),
				title: z.string().min(2).max(160),
				date: z.coerce.date(),
				startTime: z.coerce.date(),
				endTime: z.coerce.date(),
				remarks: z.string().max(500).optional(),
			}),
		)
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

			const durationMinutes = calculateDurationMinutes(
				input.startTime,
				input.endTime,
			);
			const amount = calculatePayoutAmount({
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
					startTime: input.startTime,
					endTime: input.endTime,
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
			select: { id: true, teacherCode: true, fullName: true },
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
			z.object({
				id: z.string().cuid(),
				teacherId: z.string().cuid(),
				sessionType: z.nativeEnum(SessionType),
				title: z.string().min(2).max(160),
				date: z.coerce.date(),
				startTime: z.coerce.date(),
				endTime: z.coerce.date(),
				remarks: z.string().max(500).optional().or(z.literal("")),
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

			const durationMinutes = calculateDurationMinutes(
				input.startTime,
				input.endTime,
			);
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
					startTime: input.startTime,
					endTime: input.endTime,
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
		.input(z.object({
			id: z.string().cuid(),
			status: z.nativeEnum(SessionStatus),
		}))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.facultySession.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				select: { id: true, status: true },
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });

			const session = await ctx.db.facultySession.update({
				where: { id: existing.id },
				data: { status: input.status },
			});

			await ctx.db.auditLog.create({
				data: {
					organizationId: ctx.tenant.organizationId,
					userId: ctx.tenant.userId,
					action: input.status === SessionStatus.APPROVED ? "SESSION_APPROVED" : "SESSION_STATUS_CHANGED",
					entity: "FacultySession",
					entityId: session.id,
					oldValue: { status: existing.status },
					newValue: { status: input.status },
				},
			});

			return session;
		}),

	bulkApproveSessions: tenantProcedure
		.input(z.object({
			month: z.number().int().min(1).max(12),
			year: z.number().int().min(2000).max(2100),
			teacherId: z.string().cuid().optional(),
		}))
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
					newValue: { approved: result.count, teacherId: input.teacherId ?? null },
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
					select: { status: true, bonusAmount: true, deductionAmount: true, tdsAmount: true },
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
					include: { teacher: { select: { fullName: true, teacherCode: true } }, organization: { select: { name: true } } },
				});

				// Generate + upload payslip PDF to MinIO (best-effort, don't fail payroll on storage error)
				try {
					const { generatePayslipPdf } = await import("@/server/services/payroll/generate-payslip-pdf");
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
					await ctx.db.payroll.update({ where: { id: payrollRecord.id }, data: { payslipKey } });
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
					newValue: { month: input.month, year: input.year, generated, skippedPaid },
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
					teacher: { select: { fullName: true, teacherCode: true } },
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
		.input(z.object({
			id: z.string().cuid(),
			paymentMethod: z.nativeEnum(PaymentMethod),
			paymentReference: z.string().max(120).optional(),
			paidAt: z.coerce.date().optional(),
		}))
		.mutation(async ({ ctx, input }) => {
			if (ctx.tenant.role !== Role.ORG_OWNER && ctx.tenant.role !== Role.MANAGER) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Only owners and managers can record payments." });
			}
			const existing = await ctx.db.payroll.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				include: { teacher: { select: { fullName: true, teacherCode: true } }, organization: { select: { name: true } } },
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll not found." });

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
				const { generatePayslipPdf } = await import("@/server/services/payroll/generate-payslip-pdf");
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
				await ctx.db.payroll.update({ where: { id: payroll.id }, data: { payslipKey } });
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
					newValue: { paymentMethod: input.paymentMethod, paymentReference: input.paymentReference ?? null },
				},
			});

			return payroll;
		}),

	// Apply bonus / deduction / TDS adjustments → recompute net
	updatePayrollAdjustments: tenantProcedure
		.input(z.object({
			id: z.string().cuid(),
			bonusAmount: z.number().min(0).max(10_000_000).default(0),
			deductionAmount: z.number().min(0).max(10_000_000).default(0),
			tdsAmount: z.number().min(0).max(10_000_000).default(0),
			adjustmentNote: z.string().max(300).optional(),
		}))
		.mutation(async ({ ctx, input }) => {
			if (ctx.tenant.role !== Role.ORG_OWNER && ctx.tenant.role !== Role.MANAGER) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Only owners and managers can adjust payroll." });
			}
			const existing = await ctx.db.payroll.findFirst({
				where: { id: input.id, organizationId: ctx.tenant.organizationId },
				select: { id: true, status: true, totalAmount: true },
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll not found." });
			if (existing.status === PayrollStatus.PAID) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot adjust a payroll that is already paid. Revert it first." });
			}

			const total = Number(existing.totalAmount);
			const net = Number((total + input.bonusAmount - input.deductionAmount - input.tdsAmount).toFixed(2));

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
					newValue: { bonus: input.bonusAmount, deduction: input.deductionAmount, tds: input.tdsAmount, net },
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
			if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll not found." });
			if (existing.status === PayrollStatus.PAID) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot recalculate a paid payroll. Revert it first." });
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

			const agg = { live: 0, recording: 0, youtube: 0, other: 0, total: 0, minutes: 0, count: 0 };
			for (const s of sessions) {
				const amount = Number(s.amount);
				agg.total += amount;
				agg.minutes += s.durationMinutes;
				agg.count += 1;
				if (s.sessionType === SessionType.LIVE_CLASS) agg.live += amount;
				else if (s.sessionType === SessionType.RECORDING) agg.recording += amount;
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
			if (ctx.tenant.role !== Role.ORG_OWNER && ctx.tenant.role !== Role.MANAGER) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Only org owners and managers can update organization settings." });
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
					select: { id: true, name: true, email: true, image: true, createdAt: true },
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
				throw new TRPCError({ code: "FORBIDDEN", message: "Only org owners can change member roles." });
			}
			if (input.userId === ctx.tenant.userId) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot change your own role." });
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
				where: { userId_organizationId: { userId: input.userId, organizationId: ctx.tenant.organizationId } },
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
				throw new TRPCError({ code: "FORBIDDEN", message: "Only org owners can remove members." });
			}
			if (input.userId === ctx.tenant.userId) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself." });
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
				where: { userId_organizationId: { userId: input.userId, organizationId: ctx.tenant.organizationId } },
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
		.input(z.object({
			email: z.string().email(),
			role: z.enum(["MANAGER", "ORG_OWNER"]),
		}))
		.mutation(async ({ ctx, input }) => {
			if (ctx.tenant.role !== Role.ORG_OWNER && ctx.tenant.role !== Role.MANAGER) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Only org owners and managers can invite members." });
			}
			// Check if already a member via UserOrganization (correct — not active org)
			const existing = await ctx.db.user.findUnique({
				where: { email: input.email },
				select: { id: true },
			});
			if (existing) {
				const alreadyMember = await ctx.db.userOrganization.findUnique({
					where: { userId_organizationId: { userId: existing.id, organizationId: ctx.tenant.organizationId } },
				});
				if (alreadyMember) {
					throw new TRPCError({ code: "BAD_REQUEST", message: "This person is already a member of the organization." });
				}
			}
			// Expire any previous pending invite for same email in this org
			await ctx.db.orgInvite.updateMany({
				where: { organizationId: ctx.tenant.organizationId, email: input.email, acceptedAt: null },
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
			select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
		});
	}),

	cancelInvite: tenantProcedure
		.input(z.object({ inviteId: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.tenant.role !== Role.ORG_OWNER && ctx.tenant.role !== Role.MANAGER) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			const invite = await ctx.db.orgInvite.findFirst({
				where: { id: input.inviteId, organizationId: ctx.tenant.organizationId },
			});
			if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
			await ctx.db.orgInvite.delete({ where: { id: input.inviteId } });
			return { ok: true };
		}),

	getProfile: tenantProcedure.query(async ({ ctx }) => {
		const user = await ctx.db.user.findUnique({
			where: { id: ctx.tenant.userId },
			select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
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
				try { await deleteObject(teacher.avatar); } catch { /* ignore */ }
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
				where: { id: input.teacherId, organizationId: ctx.tenant.organizationId },
				select: { avatar: true },
			});
			if (!teacher?.avatar) return { url: null };
			const url = await getPresignedUrl(teacher.avatar, 60 * 60 * 24);
			return { url };
		}),

	// Add/remove session attachment: accepts base64 data URI
	addSessionAttachment: tenantProcedure
		.input(z.object({
			sessionId: z.string().cuid(),
			fileName: z.string(),
			dataUrl: z.string(),
		}))
		.mutation(async ({ ctx, input }) => {
			const orgId = ctx.tenant.organizationId;
			const session = await ctx.db.facultySession.findFirst({
				where: { id: input.sessionId, organizationId: orgId },
			});
			if (!session) throw new TRPCError({ code: "NOT_FOUND" });

			const [header, b64] = input.dataUrl.split(",");
			const contentType = header?.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
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

			try { await deleteObject(input.key); } catch { /* ignore */ }

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
			doc.setTextColor(0);

			autoTable(doc, {
				head: [input.columns],
				body: input.body,
				startY: 40,
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

	// ─── Multi-Org ───────────────────────────────────────────────────────────

	listMyOrganizations: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await ctx.db.userOrganization.findMany({
			where: { userId: ctx.session.user.id },
			include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
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
			const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}-${ctx.session.user.id.slice(0, 6)}`;
			const org = await ctx.db.organization.create({
				data: {
					name: input.name,
					slug,
					ownerId: ctx.session.user.id,
				},
			});
			// Add creator as ORG_OWNER in membership table
			await ctx.db.userOrganization.create({
				data: { userId: ctx.session.user.id, organizationId: org.id, role: Role.ORG_OWNER },
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
				where: { userId_organizationId: { userId: ctx.session.user.id, organizationId: input.organizationId } },
			});
			if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of that organization." });
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
			if (ctx.tenant.role !== Role.ORG_OWNER && ctx.tenant.role !== Role.MANAGER) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			const teacher = await ctx.db.teacher.findFirst({
				where: { id: input.teacherId, organizationId: ctx.tenant.organizationId },
			});
			if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });

			const token = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
			await ctx.db.teacher.update({
				where: { id: teacher.id },
				data: { inviteToken: token, inviteExpiresAt: expiresAt, inviteEmail: teacher.email },
			});
			const appUrl = process.env.APP_URL ?? "http://localhost:3000";
			return { inviteUrl: `${appUrl}/invite/${token}`, expiresAt };
		}),

	// Teacher reading their own data (role = TEACHER, userId set on teacher record)
	myTeacherProfile: tenantProcedure.query(async ({ ctx }) => {
		const teacher = await ctx.db.teacher.findFirst({
			where: { userId: ctx.tenant.userId, organizationId: ctx.tenant.organizationId },
			include: { payoutConfig: true, organization: { select: { name: true } } },
		});
		if (!teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher profile not found." });
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
		.input(z.object({ month: z.number().int().min(1).max(12).optional(), year: z.number().int().min(2020).max(2100).optional() }))
		.query(async ({ ctx, input }) => {
			const teacher = await ctx.db.teacher.findFirst({
				where: { userId: ctx.tenant.userId, organizationId: ctx.tenant.organizationId },
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
			where: { userId: ctx.tenant.userId, organizationId: ctx.tenant.organizationId },
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
				where: { id: input.payrollId, organizationId: ctx.tenant.organizationId },
			});
			if (!payroll?.payslipKey) throw new TRPCError({ code: "NOT_FOUND", message: "Payslip PDF not yet generated." });
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
