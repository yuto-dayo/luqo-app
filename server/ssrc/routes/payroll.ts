import express from "express";
import { dbClient } from "../lib/dbClient";
import type { AuthedRequest } from "../types/authed-request";
import { supabaseAdmin } from "../services/supabaseClient";
import { calculateGooglePayroll } from "../lib/payrollCalculator";

const payrollRouter = express.Router();

// プレビューAPI
payrollRouter.post("/preview", (req, res) => {
  try {
    const {
      profit,
      companyRate = 0.0,
      p = 2.0,
      peerUnit = 500,
      workers = [],
    } = req.body;

    const result = calculateGooglePayroll(
      Number(profit),
      Number(companyRate),
      Number(p),
      Number(peerUnit),
      workers
    );

    res.json({
      ok: true,
      summary: {
        profit,
        distributable: result.distributable,
        companyRate,
        p,
        peerUnit,
        payGap: result.payGap,
      },
      items: result.items,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 確定API
payrollRouter.post("/commit", async (req, res) => {
  const r = req as AuthedRequest;
  if (!r.userId) return res.status(401).json({ ok: false });

  try {
    const { month, profit, companyRate, p, peerUnit, workers } = req.body;

    // 再計算して整合性を担保
    const result = calculateGooglePayroll(
      Number(profit),
      Number(companyRate),
      Number(p),
      Number(peerUnit),
      workers
    );

    const timestamp = new Date().toISOString();

    const promises = result.items.map((item) => {
      return dbClient.appendEvent({
        userId: item.userId,
        kind: "payroll_statement",
        createdAt: timestamp,
        text: `【給与確定】${month}分: ¥${item.amount.toLocaleString()} (技術:¥${item.basePay.toLocaleString()} + ピア:¥${item.peerPay.toLocaleString()})`,
        payload: {
          month,
          strategy: "google-decoupled", // ロジック識別子
          ...item,
        },
      }, r.supabase);
    });

    promises.push(
      dbClient.appendEvent({
        userId: r.userId,
        kind: "payroll_commit_log",
        createdAt: timestamp,
        text: `【管理者】${month}分給与確定 (対象:${workers.length}名, 倍率:${result.payGap}倍)`,
        payload: {
          month,
          profit,
          distributable: result.distributable,
          totalPay: result.items.reduce((s, i) => s + i.amount, 0),
        },
      }, r.supabase)
    );

    await Promise.all(promises);
    res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Commit failed" });
  }
});

// 履歴取得API
payrollRouter.get("/history", async (req, res) => {
  const r = req as AuthedRequest;
  if (!r.userId) return res.status(401).json({ ok: false });

  const userId = r.userId;
  const { month } = req.query;

  try {
    const { data, error } = await r.supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "payroll_statement")
      .order("created_at", { ascending: false });

    if (error) throw error;

    let items = data || [];
    if (month && typeof month === "string") {
      items = items.filter((row: any) => row.payload?.month === month);
    }

    const history = items.map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      ...row.payload,
    }));

    res.json({ ok: true, history });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Fetch history failed" });
  }
});

export default payrollRouter;
