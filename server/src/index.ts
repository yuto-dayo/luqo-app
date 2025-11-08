import "dotenv/config";
import express from "express";
import cors from "cors";
import { json } from "express";
import { expensesRouter } from "./routes/expenses";
import { salesRouter } from "./routes/sales";
import { luqoScoreRouter } from "./routes/luqoScore";
import luqoLogRouter from "./routes/luqoLog";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// CORS（開発用）
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// JSONボディ
app.use(json());

// ルート定義
app.use(luqoLogRouter);
app.use("/api/v1/luqo/expenses", expensesRouter);
app.use("/api/v1/luqo/sales", salesRouter);
// ★ prefix を /api/v1/luqo に変更
app.use("/api/v1/luqo", luqoScoreRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`LUQO server listening on http://localhost:${PORT}`);

  // ★ Express の _router が初期化されるのを待ってからルート一覧を表示
  setTimeout(() => {
    try {
      const routes: { path: string; methods: string[] }[] = [];
      (app as any)._router?.stack?.forEach((layer: any) => {
        if (layer.route && layer.route.path) {
          routes.push({
            path: layer.route.path,
            methods: Object.keys(layer.route.methods ?? {}),
          });
        }
      });
      console.log("[routes]", routes);
    } catch (err) {
      console.error("Failed to dump routes:", err);
    }
  }, 1000);
});
