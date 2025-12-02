import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { STAR_CATALOG, StarItem } from "../data/starCatalog";
import { useUserId } from "../hooks/useLuqoStore";
import { fetchTScoreState, postTScoreAction, fetchUserProfiles } from "../lib/api";
import { useSnackbar } from "../contexts/SnackbarContext";
import { loadTScoreStateCache, saveTScoreStateCache } from "../lib/cacheUtils";

// 型定義
type StarStatus = "unlocked" | "pending" | "locked";

export default function TScorePage() {
    const navigate = useNavigate();
    const myUserId = useUserId() ?? "demo-user";
    const { userId: paramUserId } = useParams();

    const targetUserId = paramUserId ?? myUserId;
    const isOwnPage = targetUserId === myUserId;

    const { showSnackbar } = useSnackbar();

    // --- State (APIから取得) ---
    const [acquiredIds, setAcquiredIds] = useState<Set<string>>(new Set());
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [targetUserName, setTargetUserName] = useState<string>(targetUserId); // ユーザー名（初期値はuserId）

    // --- Fetch State（キャッシュ優先） ---
    useEffect(() => {
        let active = true;
        setLoading(true);

        // まずキャッシュをチェック
        const cached = loadTScoreStateCache(targetUserId);
        if (cached) {
            setAcquiredIds(new Set(cached.acquired));
            setPendingIds(new Set(cached.pending));
            setLoading(false);
        } else {
            // キャッシュがない場合のみAPIを呼び出す
            fetchTScoreState(targetUserId)
                .then((res) => {
                    if (active && res.ok) {
                        setAcquiredIds(new Set(res.state.acquired));
                        setPendingIds(new Set(res.state.pending));
                        // 取得したデータをキャッシュに保存
                        saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                    }
                })
                .catch((err) => console.error("Failed to fetch T-Score state", err))
                .finally(() => {
                    if (active) setLoading(false);
                });
        }

        // ユーザー名を取得
        fetchUserProfiles([targetUserId])
            .then((profiles) => {
                if (active) {
                    setTargetUserName(profiles[targetUserId] || targetUserId);
                }
            })
            .catch((err) => console.error("Failed to fetch user profile", err));

        return () => {
            active = false;
        };
    }, [targetUserId]);

    // モーダル用state
    const [applyingStar, setApplyingStar] = useState<StarItem | null>(null);
    const [reviewingStar, setReviewingStar] = useState<StarItem | null>(null);
    const [evidenceText, setEvidenceText] = useState("");

    // --- Actions ---

    // 申請 (Apply)
    const handleApply = async () => {
        if (!applyingStar) return;
        try {
            const res = await postTScoreAction("apply", applyingStar.id, targetUserId);
            if (res.ok) {
                setAcquiredIds(new Set(res.state.acquired));
                setPendingIds(new Set(res.state.pending));
                // キャッシュを更新
                saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                showSnackbar(`「${applyingStar.label}」を申請しました！`, "success");
                setApplyingStar(null);
                setEvidenceText("");
            }
        } catch (e) {
            console.error(e);
            showSnackbar("エラーが発生しました", "error");
        }
    };

    // 承認 (Approve)
    const handleApprove = async () => {
        if (!reviewingStar) return;
        try {
            const res = await postTScoreAction("approve", reviewingStar.id, targetUserId);
            if (res.ok) {
                setAcquiredIds(new Set(res.state.acquired));
                setPendingIds(new Set(res.state.pending));
                // キャッシュを更新
                saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                showSnackbar("承認しました！", "success");
                setReviewingStar(null);
            }
        } catch (e) {
            console.error(e);
            showSnackbar("エラーが発生しました", "error");
        }
    };

    // 否決 (Reject)
    const handleReject = async () => {
        if (!reviewingStar) return;
        try {
            const res = await postTScoreAction("reject", reviewingStar.id, targetUserId);
            if (res.ok) {
                setAcquiredIds(new Set(res.state.acquired));
                setPendingIds(new Set(res.state.pending));
                // キャッシュを更新
                saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                showSnackbar("否決しました", "info");
                setReviewingStar(null);
            }
        } catch (e) {
            console.error(e);
            showSnackbar("エラーが発生しました", "error");
        }
    };

    // --- Calculation ---
    const currentPoints = useMemo(() => {
        return STAR_CATALOG
            .filter((item) => acquiredIds.has(item.id))
            .reduce((sum, item) => sum + item.points, 0);
    }, [acquiredIds]);

    const maxPoints = 170;

    if (loading) {
        return <div className="page" style={{ padding: 20 }}>Loading...</div>;
    }

    return (
        <div className="page">
            {/* ヘッダー */}
            <header
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "rgba(255,255,255,0.8)",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    backdropFilter: "blur(10px)",
                    borderBottom: "1px solid #e5e7eb",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", padding: 4 }}
                    >
                        ←
                    </button>
                    <div>
                        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                            {isOwnPage ? "My T-Score" : `${targetUserName}'s T-Score`}
                        </h1>
                        <span style={{ fontSize: 11, color: "#64748b" }}>技術レベル詳細評価</span>
                    </div>
                </div>
            </header>

            <div className="page__content page__content--narrow" style={{ padding: 20 }}>

                {/* スコア表示 */}
                <section
                    className="card"
                    style={{
                        textAlign: "center",
                        marginBottom: 24,
                        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                        color: "white",
                        padding: "32px 16px"
                    }}
                >
                    <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>現在の技術評価点</p>
                    <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                        {currentPoints}
                        <span style={{ fontSize: 16, fontWeight: 400, opacity: 0.6, marginLeft: 4 }}>/ {maxPoints}</span>
                    </div>
                    <div style={{ marginTop: 16, fontSize: 12, background: "rgba(255,255,255,0.1)", display: "inline-block", padding: "4px 12px", borderRadius: 99 }}>
                        取得スター数: {acquiredIds.size} / {STAR_CATALOG.length} 個
                    </div>
                </section>

                {/* カテゴリ別リスト */}
                <CategorySection
                    title="パテ作業 (Putty)"
                    items={STAR_CATALOG.filter((i) => i.category === "putty")}
                    acquiredIds={acquiredIds}
                    pendingIds={pendingIds}
                    isOwnPage={isOwnPage}
                    onItemClick={(item, status) => {
                        if (isOwnPage) {
                            if (status === "locked") setApplyingStar(item);
                        } else {
                            if (status === "pending") setReviewingStar(item);
                        }
                    }}
                />

                <CategorySection
                    title="クロス施工 (Cloth)"
                    items={STAR_CATALOG.filter((i) => i.category === "cloth")}
                    acquiredIds={acquiredIds}
                    pendingIds={pendingIds}
                    isOwnPage={isOwnPage}
                    onItemClick={(item, status) => {
                        if (isOwnPage) {
                            if (status === "locked") setApplyingStar(item);
                        } else {
                            if (status === "pending") setReviewingStar(item);
                        }
                    }}
                />
            </div>

            {/* 申請モーダル */}
            {applyingStar && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ marginTop: 0 }}>⭐️ {applyingStar.label} を申請</h3>
                        <p style={{ fontSize: 13, color: "#4b5563" }}>
                            申請には「根拠」が必要です。該当するログの日付や成果を記入してください。
                        </p>
                        <textarea
                            placeholder="例: 10/5の現場で、○○の問題を独力で解決しました"
                            value={evidenceText}
                            onChange={e => setEvidenceText(e.target.value)}
                            style={{ width: "100%", height: 80, padding: 8, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16 }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => setApplyingStar(null)} style={btnSecondary}>キャンセル</button>
                            <button
                                onClick={handleApply}
                                disabled={!evidenceText.trim()}
                                style={evidenceText.trim() ? btnPrimary : btnDisabled}
                            >
                                申請する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* レビューモーダル */}
            {reviewingStar && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ marginTop: 0 }}>📝 申請のレビュー</h3>
                        <p style={{ fontSize: 14 }}>
                            <strong>{targetUserName}</strong> さんが「{reviewingStar.label}」を申請中。
                        </p>
                        <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 8, fontSize: 13, color: "#374151", marginBottom: 16 }}>
                            <strong>根拠:</strong><br />
                            「現場のログを確認してください。完了写真もアップ済みです。」<br />
                            <span style={{ fontSize: 10, color: "#9ca3af" }}>※デモテキスト</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => setReviewingStar(null)} style={btnSecondary}>あとで</button>
                            <button onClick={handleReject} style={{ ...btnSecondary, color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}>否決</button>
                            <button onClick={handleApprove} style={btnPrimary}>承認する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// サブコンポーネントとスタイルは前回と同じ（省略せず記載する場合は前回コードを参照）
const CategorySection = ({
    title,
    items,
    acquiredIds,
    pendingIds,
    isOwnPage,
    onItemClick,
}: {
    title: string;
    items: StarItem[];
    acquiredIds: Set<string>;
    pendingIds: Set<string>;
    isOwnPage: boolean;
    onItemClick: (item: StarItem, status: StarStatus) => void;
}) => {
    return (
        <section style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#334155", marginBottom: 12, paddingLeft: 4 }}>
                {title}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => {
                    const isAcquired = acquiredIds.has(item.id);
                    const isPending = pendingIds.has(item.id);

                    let status: StarStatus = "locked";
                    if (isAcquired) status = "unlocked";
                    else if (isPending) status = "pending";

                    const isActionable = (isOwnPage && status === "locked") || (!isOwnPage && status === "pending");

                    return (
                        <div
                            key={item.id}
                            onClick={() => isActionable && onItemClick(item, status)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 16px",
                                borderRadius: 12,
                                background: isAcquired
                                    ? "#ffffff"
                                    : isPending
                                        ? "#fffbeb"
                                        : "rgba(255,255,255,0.5)",
                                border: `1px solid ${isAcquired
                                    ? "#bfdbfe"
                                    : isPending
                                        ? "#fcd34d"
                                        : "#e2e8f0"
                                    }`,
                                opacity: status === "locked" ? 0.6 : 1,
                                cursor: isActionable ? "pointer" : "default",
                                position: "relative"
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 14, fontWeight: isAcquired ? 600 : 400, color: "#1e293b" }}>
                                    {item.label}
                                </span>
                                {isPending && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", marginTop: 2 }}>
                                        🕑 申請中 (レビュー待ち)
                                    </span>
                                )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                                    {item.points}pt
                                </span>
                                <span style={{ fontSize: 18 }}>
                                    {isAcquired ? "⭐️" : isPending ? "✋" : "⚪️"}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const modalOverlayStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16
};
const modalContentStyle: React.CSSProperties = {
    background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
};
const btnBase: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", border: "1px solid transparent"
};
const btnPrimary: React.CSSProperties = {
    ...btnBase, background: "#2563eb", color: "white"
};
const btnSecondary: React.CSSProperties = {
    ...btnBase, background: "white", color: "#374151", borderColor: "#d1d5db"
};
const btnDisabled: React.CSSProperties = {
    ...btnBase, background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed"
};
