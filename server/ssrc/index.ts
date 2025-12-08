import "dotenv/config";
import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/authMiddleware";
import { luqoScoreRouter } from "./routes/luqoScore";
import { logsRouter } from "./routes/logs";
import paymasterRouter from "./routes/paymaster";
import payrollRouter from "./routes/payroll";
import {
  incidentEvaluationRouter,
  luqoEvaluationRouter,
  paymasterEvaluationRouter,
  tScoreEvaluationRouter,
} from "./routes/aiEvaluations";
import banditRouter from "./routes/bandit";

import tscoreRouter from "./routes/tscore";
import agentRouter from "./routes/agent";
import notificationsRouter from "./routes/notifications";
import accountingRouter from "./routes/accounting";
import masterRouter from "./routes/master";
import userRouter from "./routes/user";
import { supabaseAdmin } from "./services/supabaseClient";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// CORS設定: 開発環境ではすべてのオリジンを許可（スマホから接続するために必要）
app.use(cors({
  origin: true, // すべてのオリジンを許可（開発環境用）
  credentials: true, // クッキーや認証ヘッダーを許可
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// リクエストログ（デバッグ用）
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    host: req.headers.host,
    ip: req.ip,
  });
  next();
});

// 明示的に受信サイズを制限して、巨大なBase64入力によるDoSを防ぐ
app.use(express.json({ limit: "10mb" }));

// ヘルスチェックは認証不要
app.get("/health", async (_req, res) => {
  try {
    // Supabase接続テスト
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);
    
    if (error) {
      return res.status(503).json({ 
        ok: false, 
        error: "Supabase connection failed",
        details: error.message,
        code: error.code
      });
    }
    
    res.json({ 
      ok: true, 
      supabase: "connected",
      url: process.env.SUPABASE_URL 
    });
  } catch (err: any) {
    res.status(503).json({ 
      ok: false, 
      error: "Supabase connection timeout",
      details: err?.message || "Unknown error"
    });
  }
});

// 接続テスト用エンドポイント（認証不要、デバッグ用）
app.get("/api/v1/test", (_req, res) => {
  res.json({
    ok: true,
    message: "Server is reachable",
    timestamp: new Date().toISOString(),
    serverIP: _req.socket.localAddress,
    clientIP: _req.ip,
    origin: _req.headers.origin,
  });
});

app.use(authMiddleware);
app.use("/api/v1/logs", logsRouter);
app.use("/api/v1/luqo", luqoScoreRouter);
app.use("/api/v1/luqo", luqoEvaluationRouter);
app.use("/api/v1/tscore", tscoreRouter); // Changed to use tscoreRouter
app.use("/api/v1/paymaster", paymasterRouter);
app.use("/api/v1/paymaster", paymasterEvaluationRouter);
app.use("/api/v1/payroll", payrollRouter);
app.use("/api/v1/incidents", incidentEvaluationRouter);
app.use("/api/v1/bandit", banditRouter);
app.use("/api/v1/agent", agentRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/accounting", accountingRouter);
app.use("/api/v1/master", masterRouter);
app.use("/api/v1/user", userRouter);

// 外部からアクセス可能にする（スマホから接続するために必要）
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LUQO server listening on http://0.0.0.0:${PORT}`);
  console.log(`Access from other devices: http://[YOUR_LOCAL_IP]:${PORT}`);
});
