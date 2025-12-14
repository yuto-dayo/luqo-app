import { promises as fs } from "fs";
import path from "path";

/**
 * アプリケーションの重要なルールや定義ファイルを読み込んで
 * AIのシステムプロンプトに埋め込める文字列として返す
 */
export async function loadProjectContext(): Promise<string> {
  try {
    // プロジェクトルートからのパスを解決
    // (実行環境によってパスの階層が変わる場合があるので注意。ここでは標準的な構成を想定)
    const projectRoot = path.resolve(__dirname, "../../.."); 
    // もしくは ssrc/ がルートの場合は path.resolve(__dirname, "../..") など調整してください

    // 1. LUQOの基本ルール
    const luqoPromptPath = path.join(__dirname, "../prompts/luqo.prompt.md");
    // 2. Tスコアの定義 (frontend側のコードを直接読む)
    const starCatalogPath = path.resolve(projectRoot, "frontend/src/data/starCatalog.ts");
    // もし fsrc/data/starCatalog.ts ならパスを調整してください
    // コンテナ内やビルド環境で frontend のファイルが見えない場合は、
    // ssrc/data/starCatalog.ts にコピーを置くのが安全です。
    
    // ここでは安全策として、ssrc/prompts 内のファイルと、もし存在すれば frontend の定義を読む形にします。
    
    let context = "## Project Knowledge Base\n\n";

    // LUQO ルール読み込み
    try {
      const luqoContent = await fs.readFile(luqoPromptPath, "utf-8");
      context += `### LUQO Evaluation Rules\n${luqoContent}\n\n`;
    } catch (e) {
      console.warn("Failed to load luqo.prompt.md", e);
    }

    // T-Score 定義 (starCatalog.ts) 読み込み
    // フロントエンドのファイルパスは環境によるので、読み込めない場合はスキップ
    // 確実に読ませたい場合は ssrc/prompts/star_catalog.md などを作ってそこに定義をコピーしてください
    try {
        // 今回の環境に合わせてパスを探索（fsrc or frontend）
        const fsrcPath = path.resolve(__dirname, "../../fsrc/data/starCatalog.ts");
        const starContent = await fs.readFile(fsrcPath, "utf-8");
        context += `### T-Score Star Catalog Definitions\n\`\`\`typescript\n${starContent}\n\`\`\`\n\n`;
    } catch (e) {
        // console.warn("Failed to load starCatalog.ts", e);
        // エラーなら何もしない
    }

    return context;
  } catch (err) {
    console.error("Error loading project context:", err);
    return "";
  }
}
