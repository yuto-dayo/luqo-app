import { appendEventRow, getAllRows } from "./sheetsAdapter";

export interface DbClient {
  appendEvent(event: any): Promise<any>;
}

const EVENTS_SHEET_NAME = "events";

export type EventRow = {
  recordedAt: string;
  userId: string;
  kind: string;
  occurredAt?: string;
  text?: string;
  raw?: any;
};

export const dbClient: DbClient = {
  async appendEvent(event) {
    const recordedAt =
      event.recordedAt ?? event.createdAt ?? event.occurredAt ?? new Date().toISOString();
    const occurredAt = event.occurredAt ?? event.createdAt ?? recordedAt ?? "";
    const payload = event.payload ?? {};
    const body = event.body ?? {};
    const text =
      body?.text ??
      payload?.text ??
      (typeof event.text === "string" ? event.text : "");
    const amount = typeof payload?.amount === "number" ? payload.amount : "";
    const revenue = typeof payload?.revenue === "number" ? payload.revenue : "";
    const luqo =
      typeof payload?.total === "number"
        ? payload.total
        : typeof payload?.luqo === "number"
          ? payload.luqo
          : "";
    const rawSource =
      Object.keys(body ?? {}).length > 0 ? body : payload ?? {};

    const row = [
      recordedAt,
      event.userId ?? "",
      event.kind ?? "",
      occurredAt,
      text,
      amount,
      revenue,
      luqo,
      JSON.stringify(rawSource ?? {}),
    ];

    await appendEventRow(EVENTS_SHEET_NAME, row);
    return event;
  },
};

export async function getEventsByUserMonth(
  userId: string,
  month: string
): Promise<EventRow[]> {
  const values: string[][] = await getAllRows(EVENTS_SHEET_NAME);

  if (!values || values.length === 0) {
    console.log("[getEventsByUserMonth] no values");
    return [];
  }

  const header = values[0];
  const rows = values.slice(1);

  const idxRecordedAt = header.indexOf("recordedAt");
  const idxUserId = header.indexOf("userId");
  const idxKind = header.indexOf("kind");
  const idxOccurredAt = header.indexOf("occurredAt");
  const idxText = header.indexOf("text");
  const idxRaw = header.indexOf("raw");

  console.log("[getEventsByUserMonth] header:", header);
  console.log("[getEventsByUserMonth] first row:", rows[0]);

  const prefix = `${month}-`; // "2025-11-"

  const mapped: EventRow[] = rows
    .filter((row) => row && row.length > 0)
    .map((row) => {
      let recordedAt = row[idxRecordedAt] ?? "";
      const occurredAt = row[idxOccurredAt] ?? "";
      const uId = row[idxUserId] ?? "";
      const kind = row[idxKind] ?? "";
      let text = row[idxText] ?? "";
      const rawStr = idxRaw >= 0 ? row[idxRaw] : undefined;

      let raw: any = undefined;
      if (rawStr) {
        try {
          raw = JSON.parse(rawStr);
        } catch {
          // パース失敗は無視
        }
      }

      // recordedAt が空なら occurredAt / raw.createdAt をフォールバック
      if (!recordedAt) {
        if (occurredAt) {
          recordedAt = occurredAt;
        } else if (raw && typeof raw.createdAt === "string") {
          recordedAt = raw.createdAt;
        }
      }

      // text 列が空なら raw.text をフォールバック
      if (!text && raw && typeof raw.text === "string") {
        text = raw.text;
      }

      return {
        recordedAt,
        userId: uId,
        kind,
        occurredAt,
        text,
        raw,
      };
    });

  console.log("[getEventsByUserMonth] mapped sample:", mapped.slice(0, 5));

  const filtered = mapped.filter((r) => {
    if (r.userId !== userId) return false;

    // 1. recordedAt があれば、素直に month でフィルタ
    if (r.recordedAt && r.recordedAt.startsWith(prefix)) {
      return true;
    }

    // 2. recordedAt が空 & kind が luqo_log のものは、
    //    暫定的に「そのユーザーの対象ログ」として全部含める
    if (!r.recordedAt && r.kind === "luqo_log") {
      return true;
    }

    return false;
  });

  console.log(
    `[getEventsByUserMonth] userId=${userId}, month=${month}, hit=${filtered.length}`
  );

  return filtered;
}
