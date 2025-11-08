import { Router } from "express";

export const salesRouter = Router();

salesRouter.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
