import { promises as fs } from "node:fs";
import path from "node:path";

const PROMPT_DIR = path.resolve(__dirname, "..", "prompts");

type PromptCacheEntry = {
  mtimeMs: number;
  content: string;
};

const promptCache = new Map<string, PromptCacheEntry>();

function assertInsidePromptDir(filePath: string) {
  const relative = path.relative(PROMPT_DIR, filePath);
  // ../ で上に抜けたり、絶対パスで外に飛んでないかチェック
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Prompt path traversal is not allowed");
  }
}

function sanitizePromptName(name: string) {
  // ドット (.) も許可して、luqo.prompt などの名前を通す
  if (!/^[a-z0-9/_\.-]+$/i.test(name)) {
    throw new Error(`Invalid prompt name: ${name}`);
  }
}

// 必要ならこういう型を別ファイルに切る
// export type PromptId = "luqo" | "tscore" | "payroll" | "incident";

export async function loadPrompt(promptName: string): Promise<string> {
  sanitizePromptName(promptName);

  const absolutePath = path.resolve(PROMPT_DIR, `${promptName}.md`);
  assertInsidePromptDir(absolutePath);

  const stat = await fs.stat(absolutePath);
  const cached = promptCache.get(absolutePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.content;
  }

  const content = await fs.readFile(absolutePath, "utf8");
  promptCache.set(absolutePath, { mtimeMs: stat.mtimeMs, content });

  return content;
}