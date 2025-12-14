/**
 * 本番環境対応ロガー
 * - 開発環境: すべてのログを出力
 * - 本番環境: error/warn のみ出力、debugログは抑制
 */

const isDevelopment = process.env.NODE_ENV === "development";

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}

const formatMessage = (level: LogLevel, args: unknown[]): string => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}]`;
};

/**
 * 本番環境では debug/info を抑制するロガー
 */
export const logger: Logger = {
    debug: (...args: unknown[]) => {
        if (isDevelopment) {
            console.log(formatMessage("debug", args), ...args);
        }
    },
    info: (...args: unknown[]) => {
        if (isDevelopment) {
            console.log(formatMessage("info", args), ...args);
        }
    },
    warn: (...args: unknown[]) => {
        console.warn(formatMessage("warn", args), ...args);
    },
    error: (...args: unknown[]) => {
        console.error(formatMessage("error", args), ...args);
    },
};

/**
 * 監査ログ用（本番環境でも出力される）
 * セキュリティ上重要なイベントを記録
 */
export const auditLog = (action: string, details: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUDIT] ${action}`, JSON.stringify(details));
};
