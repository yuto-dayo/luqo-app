import fs from "fs";
import path from "path";
import { supabaseAdmin } from "../services/supabaseClient";

/**
 * JSON形式の過去ログを一括インポートするスクリプト
 * 実行: npx ts-node ssrc/scripts/importJsonLogs.ts
 */

const JSON_FILE_PATH = "past_logs.json";

// ★ここを実際のメンバーのUUIDに書き換えてください
// Supabaseの Authentication > Users から各メンバーのUUIDをコピーして設定してください
const USER_MAP: Record<string, string> = {
  yoshino:  "REPLACE_WITH_ACTUAL_UUID_1",
  hamanaka: "REPLACE_WITH_ACTUAL_UUID_2",
  jay:      "REPLACE_WITH_ACTUAL_UUID_3",
  teru:     "REPLACE_WITH_ACTUAL_UUID_4",
  daito:    "REPLACE_WITH_ACTUAL_UUID_5"
};

async function main() {
  const filePath = path.resolve(process.cwd(), JSON_FILE_PATH);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.log("プロジェクトのルート（一番上の階層）に past_logs.json があるか確認してください。");
    return;
  }

  console.log(`Reading ${filePath}...`);
  const content = fs.readFileSync(filePath, "utf-8");
  let logs = [];
  
  try {
    logs = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse JSON. JSONの形式を確認してください。", e);
    return;
  }

  const records = [];

  for (const log of logs) {
    const userId = USER_MAP[log.user];
    if (!userId) {
      console.warn(`Skipping unknown user: ${log.user}`);
      continue;
    }

    // 月の指定 (例: "2025-10") から、その月の末日のお昼12時を設定
    const [y, m] = log.month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); 
    const createdAt = new Date(Date.UTC(y, m - 1, lastDay, 12, 0, 0)).toISOString();

    records.push({
      user_id: userId,
      kind: "luqo_log",
      created_at: createdAt,
      text: `【${log.month} 月次まとめ】\n${log.text}`,
      payload: { source: "import-past-json" }
    });
  }

  if (records.length === 0) {
    console.log("No valid records to insert.");
    return;
  }

  console.log(`Inserting ${records.length} records...`);

  const { error } = await supabaseAdmin
    .from("events")
    .insert(records);

  if (error) {
    console.error("Import failed:", error);
  } else {
    console.log(`Success! ${records.length} logs imported.`);
  }
}

main();
