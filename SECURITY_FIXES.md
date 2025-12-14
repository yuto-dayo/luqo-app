# セキュリティ修正案: `/analyze`エンドポイント

## 問題1: `/analyze`エンドポイントのセキュリティ問題

### 修正内容

#### 1. ユーザーIDの記録と検証
```typescript
accountingRouter.post("/analyze", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  
  // 使用ログを記録（監査用）
  console.log(`[Receipt Analysis] User: ${userId}, mode: ${mode}, provider: ${usedProvider}`);
  
  // ... 既存のコード
});
```

#### 2. Base64データのサイズ検証
```typescript
// Base64データのサイズを計算（Base64は元データの約1.33倍）
const base64Size = base64Data.length;
const estimatedOriginalSize = (base64Size * 3) / 4;
const maxSize = 10 * 1024 * 1024; // 10MB

if (estimatedOriginalSize > maxSize) {
  return res.status(400).json({ 
    error: "ファイルサイズが大きすぎます（10MB以下にしてください）" 
  });
}
```

#### 3. MIMEタイプの検証強化
```typescript
// 許可するMIMEタイプのホワイトリスト
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg", 
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf"
];

const match = inputBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
const mimeType = match ? match[1] : null;
const base64Data = match ? match[2] : inputBase64;

if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
  return res.status(400).json({ 
    error: "サポートされていないファイル形式です" 
  });
}
```

#### 4. Base64データの形式検証
```typescript
// Base64文字列の検証
if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
  return res.status(400).json({ 
    error: "無効なBase64データです" 
  });
}

// Base64データの長さチェック（空でないこと）
if (base64Data.length === 0) {
  return res.status(400).json({ 
    error: "ファイルデータが空です" 
  });
}
```

#### 5. エラーメッセージの情報漏洩防止
```typescript
// 本番環境では詳細なエラー情報を返さない
const errorMessage = err?.message || err?.toString() || "Unknown error";
const isDevelopment = process.env.NODE_ENV === "development";

// エラーログには詳細を記録（サーバー側のみ）
console.error("Analysis error:", {
  error: errorMessage,
  code: err?.code,
  userId: userId, // ユーザーIDを記録
  timestamp: new Date().toISOString()
});

// クライアントには安全なメッセージのみ返す
return res.status(500).json({ 
  ok: false,
  error: "解析に失敗しました。画像またはPDFを確認してください。",
  code: "PARSE_ERROR",
  // 開発環境でのみ詳細を返す
  ...(isDevelopment && { details: errorMessage })
});
```

#### 6. レート制限の検討（実装は別途）
- 同一ユーザーあたりのリクエスト数を制限
- 時間あたりのリクエスト数を制限
- Redis等を使用したレート制限の実装を検討

## 完全な修正コード例

```typescript
accountingRouter.post("/analyze", async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "認証が必要です" });
  }

  try {
    const { fileBase64, mode } = req.body;
    const inputBase64 = fileBase64 || req.body.imageBase64;

    if (!inputBase64) {
      return res.status(400).json({ error: "ファイルデータが必要です" });
    }

    // Base64データの形式検証
    const match = inputBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    const mimeType = match ? match[1] : null;
    const base64Data = match ? match[2] : inputBase64;

    // MIMEタイプの検証
    const ALLOWED_MIME_TYPES = [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf"
    ];

    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ 
        error: "サポートされていないファイル形式です" 
      });
    }

    // Base64データの検証
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data) || base64Data.length === 0) {
      return res.status(400).json({ 
        error: "無効なBase64データです" 
      });
    }

    // ファイルサイズの検証（10MB制限）
    const base64Size = base64Data.length;
    const estimatedOriginalSize = (base64Size * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (estimatedOriginalSize > maxSize) {
      return res.status(400).json({ 
        error: "ファイルサイズが大きすぎます（10MB以下にしてください）" 
      });
    }

    const isSales = mode === "sales";
    const promptId = "accounting_audit.prompt";
    const systemPrompt = await loadPromptById(promptId);
    
    // ... 既存のAI解析コード ...
    
    // 使用ログを記録（監査用）
    console.log(`[Receipt Analysis] User: ${userId}, mode: ${mode}, provider: ${usedProvider}`);

    return res.json({ ok: true, analysis, mode, provider: usedProvider });
  } catch (err: any) {
    // エラーログに詳細を記録（サーバー側のみ）
    console.error("Analysis error:", {
      error: err?.message || err?.toString(),
      code: err?.code,
      userId: userId,
      timestamp: new Date().toISOString()
    });
    
    // クライアントには安全なメッセージのみ返す
    const isDevelopment = process.env.NODE_ENV === "development";
    const errorMessage = err?.message || err?.toString() || "Unknown error";
    
    // ... 既存のエラーハンドリングコード（detailsは開発環境でのみ返す） ...
  }
});
```








