import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { STAR_CATALOG, StarItem } from "../data/starCatalog";
import { useUserId } from "../hooks/useLuqoStore";
import { fetchTScoreState, postTScoreAction, fetchUserProfiles } from "../lib/api";
import { useSnackbar } from "../contexts/SnackbarContext";
import { loadTScoreStateCache, saveTScoreStateCache } from "../lib/cacheUtils";
import { Icon } from "../components/ui/Icon";
import { Confetti } from "../components/Confetti";
import styles from "./TScorePage.module.css";

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

    // --- Fetch State（キャッシュは初期表示用、必ず最新データを取得） ---
    useEffect(() => {
        let active = true;
        setLoading(true);

        // まずキャッシュをチェック（初期表示用）
        const cached = loadTScoreStateCache(targetUserId);
        if (cached) {
            const cachedAcquired = new Set(cached.acquired);
            setAcquiredIds(cachedAcquired);
            setPendingIds(new Set(cached.pending));
            previousAcquiredIdsRef.current = cachedAcquired;
            // キャッシュがあっても、必ず最新データを取得する
            setLoading(false);
        }

        // 必ず最新の状態を取得（キャッシュをスキップ）
        fetchTScoreState(targetUserId, { skipCache: true })
            .then((res) => {
                if (active && res.ok) {
                    const fetchedAcquired = new Set(res.state.acquired);
                    const fetchedPending = new Set(res.state.pending);
                    
                    setAcquiredIds(fetchedAcquired);
                    setPendingIds(fetchedPending);
                    previousAcquiredIdsRef.current = fetchedAcquired;
                    
                    // 取得したデータをキャッシュに保存
                    saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                }
            })
            .catch((err) => console.error("Failed to fetch T-Score state", err))
            .finally(() => {
                if (active) setLoading(false);
            });

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
    
    // 紙吹雪用state
    const [showConfetti, setShowConfetti] = useState(false);
    const previousAcquiredIdsRef = useRef<Set<string>>(new Set());

    // --- Actions ---

    // 申請 (Apply)
    const handleApply = async () => {
        if (!applyingStar || !evidenceText.trim()) return;
        try {
            const res = await postTScoreAction("apply", applyingStar.id, targetUserId, evidenceText.trim());
            if (res.ok) {
                setAcquiredIds(new Set(res.state.acquired));
                setPendingIds(new Set(res.state.pending));
                // キャッシュを更新
                saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                showSnackbar(`「${applyingStar.label}」を申請しました！`, "success");
                setApplyingStar(null);
                setEvidenceText("");
            } else {
                // APIから返されたエラーメッセージを表示
                const errorMessage = (res as any).error || "申請に失敗しました";
                showSnackbar(errorMessage, "error");
            }
        } catch (e: any) {
            console.error(e);
            // エラーの詳細を取得して表示
            const errorMessage = e?.message || e?.error || "エラーが発生しました";
            showSnackbar(errorMessage, "error");
        }
    };

    // 状態を再取得する関数
    const refreshState = async () => {
        try {
            const res = await fetchTScoreState(targetUserId);
            if (res.ok) {
                const fetchedAcquired = new Set(res.state.acquired);
                const fetchedPending = new Set(res.state.pending);
                
                setAcquiredIds(fetchedAcquired);
                setPendingIds(fetchedPending);
                previousAcquiredIdsRef.current = fetchedAcquired;
                
                // キャッシュを更新
                saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                
                return { acquired: fetchedAcquired, pending: fetchedPending };
            }
        } catch (err) {
            console.error("Failed to refresh T-Score state", err);
        }
        return null;
    };

    // 承認 (Approve)
    const handleApprove = async () => {
        if (!reviewingStar) return;
        try {
            const res = await postTScoreAction("approve", reviewingStar.id, targetUserId);
            if (res.ok) {
                const isFinalized = (res as any).isFinalized === true;
                
                // 承認が確定した場合は、最新の状態を再取得
                if (isFinalized) {
                    // 少し待ってから再取得（DB更新の反映を待つ）
                    setTimeout(async () => {
                        const refreshed = await refreshState();
                        if (refreshed) {
                            // 新しく獲得したスターがあるかチェック（紙吹雪表示用）
                            const newlyAcquired = Array.from(refreshed.acquired).filter(
                                id => !previousAcquiredIdsRef.current.has(id)
                            );
                            
                            // 状態変更を通知（他のコンポーネントに再取得を促す）
                            window.dispatchEvent(new CustomEvent('tscore-state-updated', {
                                detail: { userId: targetUserId }
                            }));
                            
                            if (newlyAcquired.length > 0) {
                                setShowConfetti(true);
                                setTimeout(() => setShowConfetti(false), 3000);
                                showSnackbar("承認しました！スターを獲得しました！", "success");
                            } else {
                                showSnackbar("承認しました！", "success");
                            }
                        }
                    }, 500);
                } else {
                    // 未確定の場合はレスポンスの状態を使用
                    const newAcquiredIds = new Set(res.state.acquired);
                    const newPendingIds = new Set(res.state.pending);
                    
                    setAcquiredIds(newAcquiredIds);
                    setPendingIds(newPendingIds);
                    previousAcquiredIdsRef.current = newAcquiredIds;
                    
                    // キャッシュを更新
                    saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                    
                    showSnackbar("承認しました！", "success");
                }
                setReviewingStar(null);
            } else {
                const errorMessage = (res as any).error || "承認に失敗しました";
                showSnackbar(errorMessage, "error");
            }
        } catch (e: any) {
            console.error(e);
            const errorMessage = e?.message || e?.error || "エラーが発生しました";
            showSnackbar(errorMessage, "error");
        }
    };

    // 否決 (Reject)
    const handleReject = async () => {
        if (!reviewingStar) return;
        try {
            const res = await postTScoreAction("reject", reviewingStar.id, targetUserId);
            if (res.ok) {
                const isFinalized = (res as any).isFinalized === true;
                
                // 否決が確定した場合は、最新の状態を再取得
                if (isFinalized) {
                    setTimeout(async () => {
                        await refreshState();
                    }, 500);
                } else {
                    // 未確定の場合はレスポンスの状態を使用
                    setAcquiredIds(new Set(res.state.acquired));
                    setPendingIds(new Set(res.state.pending));
                    // キャッシュを更新
                    saveTScoreStateCache(targetUserId, res.state.acquired, res.state.pending);
                }
                showSnackbar("否決しました", "info");
                setReviewingStar(null);
            } else {
                const errorMessage = (res as any).error || "否決に失敗しました";
                showSnackbar(errorMessage, "error");
            }
        } catch (e: any) {
            console.error(e);
            const errorMessage = e?.message || e?.error || "エラーが発生しました";
            showSnackbar(errorMessage, "error");
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
            {/* 紙吹雪演出 */}
            <Confetti active={showConfetti} />
            
            {/* ヘッダー */}
            <header className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <button onClick={() => navigate(-1)} className={styles.backButton}>
                        ←
                    </button>
                    <div>
                        <h1 className={styles.pageTitle}>
                            {isOwnPage ? "My T-Score" : `${targetUserName}'s T-Score`}
                        </h1>
                        <span className={styles.pageSubtitle}>技術レベル詳細評価</span>
                    </div>
                </div>
            </header>

            <div className={styles.content}>
                {/* スコア表示 */}
                <section className={styles.scoreCard}>
                    <p className={styles.scoreLabel}>現在の技術評価点</p>
                    <div className={styles.scoreValue}>
                        {currentPoints}
                        <span className={styles.scoreMax}>/ {maxPoints}</span>
                    </div>
                    <div className={styles.scoreBadge}>
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
                <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setApplyingStar(null)}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <Icon name="star" size={20} color="var(--color-o-base)" />
                            <h3 className={styles.modalTitle}>{applyingStar.label} を申請</h3>
                        </div>
                        <p className={styles.modalDescription}>
                            申請には「根拠」が必要です。該当するログの日付や成果を記入してください。
                        </p>
                        <textarea
                            className={styles.textarea}
                            placeholder="例: 10/5の現場で、○○の問題を独力で解決しました"
                            value={evidenceText}
                            onChange={e => setEvidenceText(e.target.value)}
                        />
                        <div className={styles.buttonGroup}>
                            <button 
                                onClick={() => {
                                    setApplyingStar(null);
                                    setEvidenceText("");
                                }} 
                                className={styles.buttonSecondary}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={!evidenceText.trim()}
                                className={evidenceText.trim() ? styles.buttonPrimary : styles.buttonDisabled}
                            >
                                申請する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* レビューモーダル */}
            {reviewingStar && (
                <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setReviewingStar(null)}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <Icon name="pen" size={20} color="var(--color-lu-base)" />
                            <h3 className={styles.modalTitle}>申請のレビュー</h3>
                        </div>
                        <p className={styles.modalDescription}>
                            <strong>{targetUserName}</strong> さんが「{reviewingStar.label}」を申請中。
                        </p>
                        <div className={styles.evidenceBox}>
                            <strong className={styles.evidenceBoxLabel}>根拠:</strong><br />
                            「現場のログを確認してください。完了写真もアップ済みです。」<br />
                            <span className={styles.evidenceBoxNote}>※デモテキスト</span>
                        </div>
                        <div className={styles.buttonGroup}>
                            <button onClick={() => setReviewingStar(null)} className={styles.buttonSecondary}>あとで</button>
                            <button 
                                onClick={handleReject} 
                                className={`${styles.buttonSecondary} ${styles.buttonReject}`}
                            >
                                否決
                            </button>
                            <button onClick={handleApprove} className={styles.buttonPrimary}>承認する</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// カテゴリセクションコンポーネント
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
        <section className={styles.categorySection}>
            <h3 className={styles.categoryTitle}>
                {title}
            </h3>
            <div className={styles.categoryList}>
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
                            className={`${styles.starItem} ${
                                isAcquired 
                                    ? styles.starItemAcquired 
                                    : isPending 
                                        ? styles.starItemPending 
                                        : styles.starItemLocked
                            }`}
                        >
                            <div className={styles.starItemContent}>
                                <span className={`${styles.starItemLabel} ${isAcquired ? styles.starItemLabelAcquired : ""}`}>
                                    {item.label}
                                </span>
                                {isPending && (
                                    <span className={styles.starItemPendingBadge}>
                                        🕑 申請中 (レビュー待ち)
                                    </span>
                                )}
                            </div>

                            <div className={styles.starItemRight}>
                                <span className={styles.starItemPoints}>
                                    {item.points}pt
                                </span>
                                <span className={styles.starItemIcon}>
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

