import { Router } from "express";

export const expensesRouter = Router();

expensesRouter.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
