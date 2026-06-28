-- Add richer member profile and payout unit support.
ALTER TABLE "teacher"
ADD COLUMN "roleTitle" TEXT,
ADD COLUMN "upiId" TEXT,
ADD COLUMN "paymentQrCode" TEXT;

CREATE TYPE "RateUnit" AS ENUM ('PER_HOUR', 'PER_SESSION');

ALTER TABLE "teacher_payout_config"
ADD COLUMN "liveRateUnit" "RateUnit" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN "recordingRateUnit" "RateUnit" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN "youtubeRateUnit" "RateUnit" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN "doubtRateUnit" "RateUnit" NOT NULL DEFAULT 'PER_HOUR',
ADD COLUMN "webinarRateUnit" "RateUnit" NOT NULL DEFAULT 'PER_HOUR';
