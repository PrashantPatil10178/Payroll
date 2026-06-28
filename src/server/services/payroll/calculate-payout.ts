import { RateUnit, SessionType } from "../../../../generated/prisma";

type TeacherRates = {
	liveRate: unknown;
	liveRateUnit?: unknown;
	recordingRate: unknown;
	recordingRateUnit?: unknown;
	youtubeRate: unknown;
	youtubeRateUnit?: unknown;
	doubtRate?: unknown;
	doubtRateUnit?: unknown;
	webinarRate?: unknown;
	webinarRateUnit?: unknown;
};

export function calculateDurationMinutes(startTime: Date, endTime: Date) {
	const diff = endTime.getTime() - startTime.getTime();

	if (diff <= 0) {
		throw new Error("End time must be after start time.");
	}

	return Math.round(diff / 60000);
}

export function calculatePayoutAmount({
	durationMinutes,
	rates,
	sessionType,
}: {
	durationMinutes: number;
	rates: TeacherRates;
	sessionType: SessionType;
}) {
	const { rate, unit } = getRateConfig(rates, sessionType);
	const numericRate = Number(rate);

	if (!Number.isFinite(numericRate) || numericRate < 0) {
		throw new Error("Teacher payout rate is invalid.");
	}

	if (unit === RateUnit.PER_SESSION) {
		return Number(numericRate.toFixed(2));
	}

	return Number(((durationMinutes / 60) * numericRate).toFixed(2));
}

function getRateConfig(rates: TeacherRates, sessionType: SessionType) {
	switch (sessionType) {
		case SessionType.LIVE_CLASS:
			return {
				rate: rates.liveRate,
				unit: (rates.liveRateUnit as RateUnit | undefined) ?? RateUnit.PER_HOUR,
			};
		case SessionType.RECORDING:
			return {
				rate: rates.recordingRate,
				unit:
					(rates.recordingRateUnit as RateUnit | undefined) ??
					RateUnit.PER_HOUR,
			};
		case SessionType.YOUTUBE:
			return {
				rate: rates.youtubeRate,
				unit:
					(rates.youtubeRateUnit as RateUnit | undefined) ?? RateUnit.PER_HOUR,
			};
		case SessionType.DOUBT_SOLVING:
			return {
				rate: rates.doubtRate ?? rates.liveRate,
				unit:
					(rates.doubtRateUnit as RateUnit | undefined) ??
					(rates.liveRateUnit as RateUnit | undefined) ??
					RateUnit.PER_HOUR,
			};
		case SessionType.WEBINAR:
			return {
				rate: rates.webinarRate ?? rates.liveRate,
				unit:
					(rates.webinarRateUnit as RateUnit | undefined) ??
					(rates.liveRateUnit as RateUnit | undefined) ??
					RateUnit.PER_HOUR,
			};
	}
}
