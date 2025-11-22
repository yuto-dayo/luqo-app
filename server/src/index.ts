import "dotenv/config";
import express from "express";
import cors from "cors";
import { json } from "express";
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

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(json());
app.use("/api/v1/logs", logsRouter);
app.use("/api/v1/luqo", luqoScoreRouter);
app.use("/api/v1/luqo", luqoEvaluationRouter);
app.use("/api/v1/tscore", tScoreEvaluationRouter);
app.use("/api/v1/paymaster", paymasterRouter);
app.use("/api/v1/paymaster", paymasterEvaluationRouter);
app.use("/api/v1/payroll", payrollRouter);
app.use("/api/v1/incidents", incidentEvaluationRouter);
app.use("/api/v1/bandit", banditRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`LUQO server listening on http://localhost:${PORT}`);
});
