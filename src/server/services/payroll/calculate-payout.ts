import { SessionType } from "../../../../generated/prisma";

type TeacherRates = {
	liveRate: unknown;
	recordingRate: unknown;
	youtubeRate: unknown;
	doubtRate?: unknown;
	webinarRate?: unknown;
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
	const hourlyRate = Number(getHourlyRate(rates, sessionType));

	if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
		throw new Error("Teacher payout rate is invalid.");
	}

	return Number(((durationMinutes / 60) * hourlyRate).toFixed(2));
}

function getHourlyRate(rates: TeacherRates, sessionType: SessionType) {
	switch (sessionType) {
		case SessionType.LIVE_CLASS:
			return rates.liveRate;
		case SessionType.RECORDING:
			return rates.recordingRate;
		case SessionType.YOUTUBE:
			return rates.youtubeRate;
		case SessionType.DOUBT_SOLVING:
			return rates.doubtRate ?? rates.liveRate;
		case SessionType.WEBINAR:
			return rates.webinarRate ?? rates.liveRate;
	}
}
