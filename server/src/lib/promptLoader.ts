import { promises as fs } from "node:fs";
import path from "node:path";

const PROMPT_DIR = path.resolve(__dirname, "..", "..", "prompts");

type PromptCacheEntry = {
  mtimeMs: number;
  content: string;
};

const promptCache = new Map<string, PromptCacheEntry>();

function assertInsidePromptDir(filePath: string) {
  const relative = path.relative(PROMPT_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Prompt path traversal is not allowed");
  }
}

function sanitizePromptName(name: string) {
  if (name.includes("..")) {
    throw new Error("Prompt name cannot contain '..'");
  }
  if (!/^[a-z0-9/_\-.]+$/i.test(name)) {
    throw new Error(`Invalid prompt name: ${name}`);
  }
}

export async function loadPrompt(promptName: string): Promise<string> {
  sanitizePromptName(promptName);

  const fileName = promptName.endsWith(".md") ? promptName : `${promptName}.md`;
  const absolutePath = path.resolve(PROMPT_DIR, fileName);
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
