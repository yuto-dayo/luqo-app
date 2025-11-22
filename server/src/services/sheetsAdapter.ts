import { google } from "googleapis";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  SHEETS_SPREADSHEET_ID,
} = process.env;

if (
  !GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
  !SHEETS_SPREADSHEET_ID
) {
  console.warn(
    "[sheetsAdapter] Missing env. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SHEETS_SPREADSHEET_ID",
  );
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("[sheetsAdapter] Google service account env is not set");
  }

  // 1. 前後の空白とダブルクォートを掃除
  let key = rawKey.trim().replace(/^"|"$/g, "");

  // 2. 文字列 "\n" を本物の改行に変換
  key = key.replace(/\\n/g, "\n");

  // 3. 最終trim
  key = key.trim();

  // 確認用（中身は出さず、形だけ見る）
  const lines = key.split("\n");
  console.log("[sheetsAdapter] key check", {
    first: lines[0],
    last: lines[lines.length - 1],
    count: lines.length,
  });

  const jwt = new google.auth.JWT({
    email,
    key,
    scopes: SCOPES,
  });

  return google.sheets({ version: "v4", auth: jwt });
}

export async function appendEventRow(
  sheetName: string,
  row: (string | number | null | undefined)[],
): Promise<void> {
  if (!SHEETS_SPREADSHEET_ID) {
    throw new Error("SHEETS_SPREADSHEET_ID is not set");
  }

  const sheets = getSheetsClient();

  const values = [
    row.map((value) =>
      typeof value === "string" || typeof value === "number" ? value : value ?? "",
    ),
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

export async function getAllRows(
  sheetName: string,
): Promise<any[][]> {
  if (!SHEETS_SPREADSHEET_ID) {
    throw new Error("SHEETS_SPREADSHEET_ID is not set");
  }

  const sheets = getSheetsClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = result.data.values ?? [];
  return rows;
}
