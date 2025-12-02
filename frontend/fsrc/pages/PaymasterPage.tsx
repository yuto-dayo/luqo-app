import React, { useState, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { useSnackbar } from "../contexts/SnackbarContext";

const MOCK_USERS = [
    { userId: "yoshino", name: "吉野" },
    { userId: "hamanaka", name: "濱中" },
    { userId: "jay", name: "Jay" },
    { userId: "teru", name: "Teru" },
];

type WorkerInput = {
    userId: string;
    name: string;
    days: number;
    starsTotal: number;
    peerCount: number;
};

type PayrollItem = {
    userId: string;
    name: string;
    days: number;
    starsTotal: number;
    peerCount: number;
    combo: number;
    ratio: number;
    basePay: number;
    peerPay: number;
    amount: number;
};

type PayrollSummary = {
    profit: number;
    distributable: number;
    companyRate: number;
    p: number;
    peerUnit: number;
    payGap: string;
};

export default function PaymasterPage() {
    const [month, setMonth] = useState("2025-10");
    const [profit, setProfit] = useState(1000000);
    const [companyRate, setCompanyRate] = useState(0.0);
    const [p, setP] = useState(2.0); // Google推奨は2.0以上
    const [peerUnit, setPeerUnit] = useState(500); // 1ピア500円

    const [workers, setWorkers] = useState<WorkerInput[]>([]);
    const [preview, setPreview] = useState<PayrollItem[] | null>(null); // items
    const [summary, setSummary] = useState<PayrollSummary | null>(null); // summary info
    const [loading, setLoading] = useState(false);

    const { confirm } = useConfirm();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        // 初期値セット (LUQO入力欄は削除)
        setWorkers(MOCK_USERS.map(u => ({
            userId: u.userId,
            name: u.name,
            days: 20,
            starsTotal: 85, // 技術点 (0-170)
            peerCount: 5    // ピア数
        })));
    }, []);

    const handlePreview = async () => {
        setLoading(true);
        try {
            const res = await apiClient.post<{ ok: boolean; items: PayrollItem[]; summary: PayrollSummary }>("/api/v1/payroll/preview", {
                profit,
                companyRate,
                p,
                peerUnit,
                workers,
            });
            if (res.ok) {
                setPreview(res.items);
                setSummary(res.summary);
            }
        } catch (e) {
            console.error(e);
            showSnackbar("計算エラー", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        if (!preview) return;
        if (!(await confirm(`${month}分の給与を確定しますか？`))) return;

        setLoading(true);
        try {
            const res = await apiClient.post<{ ok: boolean }>("/api/v1/payroll/commit", {
                month,
                profit,
                companyRate,
                p,
                peerUnit,
                workers
            });
            if (res.ok) {
                showSnackbar("給与を確定しました！", "success");
                setPreview(null);
                setSummary(null);
            }
        } catch (e) {
            showSnackbar("確定に失敗しました", "error");
        } finally {
            setLoading(false);
        }
    };

    const updateWorker = (index: number, field: string, val: any) => {
        const newWorkers = [...workers];
        newWorkers[index] = { ...newWorkers[index], [field]: val };
        setWorkers(newWorkers);
    };

    return (
        <div className="page">
            <section className="card">
                <header className="card__header">
                    <h2 className="card__title">Paymaster Console (Google-Style)</h2>
                    <p className="text-muted">
                        技術(Tスコア)と感謝(Peer)のみで報酬を決定します。<br />
                        LUQO(行動評価)は報酬計算から除外されています。
                    </p>
                </header>

                {/* パラメータ設定エリア */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0", background: "#f8fafc", padding: 16, borderRadius: 12 }}>
                    <label className="text-sm font-bold">
                        対象月
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ marginTop: 4 }} />
                    </label>
                    <label className="text-sm font-bold">
                        現場純利益 (円)
                        <input type="number" value={profit} onChange={e => setProfit(Number(e.target.value))} style={{ marginTop: 4 }} />
                    </label>
                    <label className="text-sm font-bold">
                        会社取り分率 (0.0 - 1.0)
                        <input type="number" step="0.05" value={companyRate} onChange={e => setCompanyRate(Number(e.target.value))} style={{ marginTop: 4 }} />
                    </label>
                    <label className="text-sm font-bold">
                        技術ブースト指数 p (推奨2.0)
                        <input type="number" step="0.1" value={p} onChange={e => setP(Number(e.target.value))} style={{ marginTop: 4 }} />
                    </label>
                    <label className="text-sm font-bold">
                        ピアボーナス単価 (円/回)
                        <input type="number" step="100" value={peerUnit} onChange={e => setPeerUnit(Number(e.target.value))} style={{ marginTop: 4 }} />
                    </label>
                </div>

                <h3>従業員データ入力</h3>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee", color: "#64748b" }}>
                                <th style={{ padding: 8 }}>名前</th>
                                <th style={{ padding: 8 }}>稼働日数</th>
                                <th style={{ padding: 8 }}>技術スター (0-170)</th>
                                <th style={{ padding: 8 }}>ピア獲得数 (回)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workers.map((w, i) => (
                                <tr key={w.userId} style={{ borderBottom: "1px solid #f9f9f9" }}>
                                    <td style={{ padding: 8 }}>{w.name}</td>
                                    <td style={{ padding: 8 }}>
                                        <input type="number" value={w.days} style={{ width: 70 }}
                                            onChange={e => updateWorker(i, "days", Number(e.target.value))} />
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        <input type="number" value={w.starsTotal} style={{ width: 70, fontWeight: "bold", color: "#00639b" }}
                                            onChange={e => updateWorker(i, "starsTotal", Number(e.target.value))} />
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        <input type="number" value={w.peerCount} style={{ width: 70, fontWeight: "bold", color: "#b45309" }}
                                            onChange={e => updateWorker(i, "peerCount", Number(e.target.value))} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                    <button className="btn btn--primary" onClick={handlePreview} disabled={loading}>
                        計算プレビュー
                    </button>
                    {preview && (
                        <button className="btn" onClick={handleCommit} disabled={loading} style={{ background: "#1f1f1f", color: "white" }}>
                            確定して保存
                        </button>
                    )}
                </div>

                {/* プレビュー結果表示 */}
                {preview && summary && (
                    <div style={{ marginTop: 24, background: "#f0f9ff", padding: 16, borderRadius: 12, border: "1px solid #e0f2fe" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                            <h4 style={{ margin: 0, color: "#0c4a6e" }}>計算結果プレビュー</h4>
                            <div style={{ fontSize: 12, color: "#0369a1" }}>
                                原資: ¥{summary.distributable.toLocaleString()} / 格差倍率: <strong>{summary.payGap}倍</strong>
                            </div>
                        </div>

                        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #cbd5e1" }}>
                                    <th style={{ padding: "8px 4px" }}>氏名</th>
                                    <th style={{ padding: "8px 4px" }}>実力係数(Combo)</th>
                                    <th style={{ padding: "8px 4px" }}>利益配分(Base)</th>
                                    <th style={{ padding: "8px 4px" }}>ピア手当(Peer)</th>
                                    <th style={{ padding: "8px 4px", textAlign: "right" }}>支給総額</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((p: any) => (
                                    <tr key={p.userId} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                        <td style={{ padding: "8px 4px", fontWeight: "600" }}>{p.name}</td>
                                        <td style={{ padding: "8px 4px" }}>
                                            {p.combo.toFixed(0)} <span style={{ fontSize: 10, color: "#94a3b8" }}>(T^{summary.p})</span>
                                        </td>
                                        <td style={{ padding: "8px 4px" }}>¥{p.basePay.toLocaleString()}</td>
                                        <td style={{ padding: "8px 4px", color: "#b45309" }}>
                                            ¥{p.peerPay.toLocaleString()} <span style={{ fontSize: 10 }}>({p.peerCount}回)</span>
                                        </td>
                                        <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "bold", fontSize: 15, color: "#0f172a" }}>
                                            ¥{p.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
