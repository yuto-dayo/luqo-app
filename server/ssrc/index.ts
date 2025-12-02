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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// 明示的に受信サイズを制限して、巨大なBase64入力によるDoSを防ぐ
app.use(express.json({ limit: "10mb" }));
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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`LUQO server listening on http://localhost:${PORT}`);
});
