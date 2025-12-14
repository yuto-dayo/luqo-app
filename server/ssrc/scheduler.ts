import cron from "node-cron";
import { runWeeklyScoreBatch } from "./jobs/weeklyScoreJob";
import { logger } from "./lib/logger";

export function startScheduler() {
    logger.info("[Scheduler] Initializing cron jobs...");

    // 毎週月曜 04:00 JST に実行
    // 分 時 日 月 曜日 (0-6, 0=Sunday)
    // 1 = Monday
    cron.schedule("0 4 * * 1", () => {
        logger.info("[Scheduler] Triggering Weekly Score Batch");
        runWeeklyScoreBatch();
    }, {
        timezone: "Asia/Tokyo"
    });

    logger.info("[Scheduler] Jobs scheduled: Weekly Score Batch (Mon 04:00 JST)");
}
