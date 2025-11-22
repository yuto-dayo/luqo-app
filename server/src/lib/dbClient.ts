// server/src/lib/dbClient.ts
import type { EventRow } from "../models/events";
import { appendEventRow, getAllRows } from "../services/sheetsAdapter";

const EVENTS_SHEET_NAME = "events"; // シート名だけ意識すればOK

export async function getEventsByUserMonth(
  userId: string,
  month: string,
): Promise<EventRow[]> {
  const rows = await getAllRows(EVENTS_SHEET_NAME);
  const values = (rows ?? []) as (string | undefined)[][];

  // 1行目ヘッダ前提
  return values.slice(1).reduce<EventRow[]>(
    (acc: EventRow[], row: (string | undefined)[], index) => {
      const [
        recordedAt,  // A
        rowUserId,   // B
        kind,        // C
        occurredAt,  // D
        text,        // E
        amount,      // F
        revenue,     // G
      ] = row;

      if (!rowUserId || rowUserId !== userId) return acc;

      const rowMonth = (recordedAt ?? "").slice(0, 7); // "YYYY-MM"
      if (rowMonth !== month) return acc;

      acc.push({
        id: `row-${index + 2}`, // 2行目以降の行番号を簡易IDとして使う
        userId: rowUserId,
        month: rowMonth,
        createdAt: recordedAt ?? occurredAt ?? "",
        text: text ?? "",
        // 必要なら kind / amount / revenue を EventRow に拡張しても良い
      } as EventRow);

      return acc;
    },
    [],
  );
}

export async function appendEvent(event: Partial<EventRow>): Promise<EventRow> {
  const now = new Date();
  const createdAt = event.createdAt ?? now.toISOString();

  const row: EventRow = {
    id: event.id ?? `event-${now.getTime()}`,
    userId: event.userId!,
    month: createdAt.slice(0, 7), // "YYYY-MM"
    createdAt,
    text: event.text ?? "",
    ...(event as any),
  };

  const kind = "luqo_log";

  await appendEventRow(EVENTS_SHEET_NAME, [
    row.createdAt, // recordedAt (A)
    row.userId,    // userId (B)
    kind,          // kind (C)
    row.createdAt, // occurredAt (D)
    row.text,      // text (E)
    "",            // amount (F) 今は未使用
    "",            // revenue (G) 今は未使用
  ]);

  return row;
}

export const dbClient = {
  getEventsByUserMonth,
  appendEvent,
};