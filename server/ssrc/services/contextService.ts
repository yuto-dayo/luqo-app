
import { dbClient } from "../lib/dbClient";
import { supabaseAdmin } from "./supabaseClient";
import { ACCOUNTING_EVENTS, type SalePayload } from "../types/accounting";

export type UserContext = {
    period: {
        start: string;
        end: string;
    };
    activity: {
        logCount: number;
        totalChars: number;
        lastLogDate: string | null;
    };
    accounting: {
        totalSales: number;
        salesCount: number;
        totalExpenses: number;
        expenseCount: number;
    };
    ops: {
        earnedPoints: number;
    };
};

/**
 * Get aggregated user context for a specific period.
 * This data is used to inform AI scoring and mission generation.
 */
export async function getUserContext(
    userId: string,
    startDate: string,
    endDate: string
): Promise<UserContext> {
    // 1. Fetch all events in the period
    const events = await dbClient.getEventsByUserPeriod(
        userId,
        startDate,
        endDate,
        supabaseAdmin
    );

    // 2. Initialize aggregated data
    const context: UserContext = {
        period: { start: startDate, end: endDate },
        activity: { logCount: 0, totalChars: 0, lastLogDate: null },
        accounting: { totalSales: 0, salesCount: 0, totalExpenses: 0, expenseCount: 0 },
        ops: { earnedPoints: 0 },
    };

    // 3. Aggregate
    for (const event of events) {
        // Activity (Logs)
        if (event.kind === "log" || event.kind === "daily_report") {
            context.activity.logCount++;
            context.activity.totalChars += (event.text || "").length;

            const createdAt = event.createdAt || "";
            if (createdAt) {
                if (
                    !context.activity.lastLogDate ||
                    new Date(createdAt) > new Date(context.activity.lastLogDate)
                ) {
                    context.activity.lastLogDate = createdAt;
                }
            }
        }

        // Accounting - Sales
        if (event.kind === ACCOUNTING_EVENTS.SALE_REGISTERED) {
            const payload = event.raw as SalePayload;
            // Exclude reversals
            if (!(payload as any).isReversal) {
                context.accounting.totalSales += Number(payload.amount) || 0;
                context.accounting.salesCount++;
            }
        }

        // Accounting - Expenses
        if (event.kind === ACCOUNTING_EVENTS.EXPENSE_REGISTERED) {
            const payload = event.raw as any;
            if (!payload.isReversal) {
                context.accounting.totalExpenses += Number(payload.amount) || 0;
                context.accounting.expenseCount++;
            }
        }

        // Ops Points
        if (event.kind === ACCOUNTING_EVENTS.OPS_POINT_GRANTED) {
            const payload = event.raw as any;
            if (!payload.isReversal) {
                context.ops.earnedPoints += Number(payload.amount) || 0;
            }
        }
    }

    return context;
}
