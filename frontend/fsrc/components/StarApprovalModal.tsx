import React, { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "../lib/apiClient";
import { VoteProgress } from "./VoteProgress";
import { useSnackbar } from "../contexts/SnackbarContext";
import { fetchUserProfiles } from "../lib/api";
import { loadUserNamesCache, saveUserNamesCache, getUserNameFromCache } from "../lib/cacheUtils";
import { useTScoreRealtime } from "../hooks/useTScoreRealtime";

type VoteRecord = {
  approvers: string[];
  rejecters: string[];
  passers?: string[];
};

type PendingItem = {
  userId: string;
  userName?: string; // ユーザーネームを追加
  pending: string[];
  votes?: Record<string, VoteRecord>;
};

type Stats = {
  totalUsers: number;
  pendingCount: number;
};

type PendingResponse = {
  ok: boolean;
  items: PendingItem[];
};

type StatsResponse = {
  ok: boolean;
  stats: Stats;
};

export const StarApprovalModal: React.FC = () => {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({}); // userId -> name のマップ

  // 否決モード管理
  const [rejectingTarget, setRejectingTarget] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const { showSnackbar } = useSnackbar();
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const FETCH_DEBOUNCE_MS = 1000; // 1秒以内の連続呼び出しを防ぐ

  const fetchDataInternal = useCallback(async () => {
    if (isFetchingRef.current) return; // 既に取得中の場合はスキップ
    isFetchingRef.current = true;
    
    try {
      // ローディング中も裏で再取得できるように、初回以外はsetLoadingしない制御も可
      // ここではシンプルに
      const [pendingRes, statsRes] = await Promise.all([
        apiClient.get<PendingResponse>("/api/v1/tscore/pending"),
        apiClient.get<StatsResponse>("/api/v1/tscore/stats"),
      ]);

      if (pendingRes.ok) {
        setItems(pendingRes.items);
        
        // ユーザー名を取得（優先順位: APIレスポンス > キャッシュ > fetchUserProfiles）
        const userIds = pendingRes.items.map((item) => item.userId);
        const profilesMap: Record<string, string> = {};
        
        // 1. まずキャッシュから取得
        const cachedNames = loadUserNamesCache();
        Object.assign(profilesMap, cachedNames);
        
        // 2. APIレスポンスから取得したuserNameを優先（最新情報）
        pendingRes.items.forEach((item) => {
          if (item.userName) {
            profilesMap[item.userId] = item.userName;
          }
        });
        
        // 3. まだ取得できていないユーザー名のみ追加取得
        const missingUserIds = userIds.filter((id) => !profilesMap[id]);
        if (missingUserIds.length > 0) {
          const additionalProfiles = await fetchUserProfiles(missingUserIds);
          Object.assign(profilesMap, additionalProfiles);
        }
        
        // 4. 取得したユーザー名をキャッシュに保存
        saveUserNamesCache(profilesMap);
        
        setUserNames(profilesMap);
      }
      if (statsRes.ok) setStats(statsRes.stats);
    } catch (e) {
      console.error("Failed to fetch pending approvals", e);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // デバウンス付きのfetchData
  const fetchData = useCallback(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // 既にスケジュールされているタイマーをクリア
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    if (timeSinceLastFetch < FETCH_DEBOUNCE_MS) {
      // デバウンス期間内なら、残り時間後に実行
      fetchTimeoutRef.current = setTimeout(() => {
        lastFetchTimeRef.current = Date.now();
        void fetchDataInternal();
      }, FETCH_DEBOUNCE_MS - timeSinceLastFetch);
    } else {
      // デバウンス期間を過ぎているなら即座に実行
      lastFetchTimeRef.current = now;
      void fetchDataInternal();
    }
  }, [fetchDataInternal]);

  // クリーンアップ: タイマーをクリア
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void fetchData();
    // アンマウント時に保留中のアクションがあれば即時実行する処理を入れるのが理想だが
    // 今回はシンプルにアンマウントでキャンセルされないようにRefで保持し続ける
    return () => {
      // コンポーネントが消えてもタイマーは走り続け、APIは呼ばれる (安全)
      // ただしメモリリーク警告が出る可能性はあるが、関数コンポーネントのスコープ内なので許容
    };
  }, [fetchData]);

  // Supabase RealtimeでDB変更を監視（変更があった場合のみ更新）
  useTScoreRealtime(fetchData, true);

  /**
   * 承認/保留の共通処理 (即時実行)
   */
  const handleAction = async (targetUserId: string, starId: string, actionType: "approve" | "pass") => {
    // 1. UIから即座に消す (楽観的更新)
    const previousItems = [...items];
    setItems((prev) => prev.map(u => {
      if (u.userId !== targetUserId) return u;
      return { ...u, pending: u.pending.filter(id => id !== starId) };
    }).filter(u => u.pending.length > 0));

    // 2. スナックバー表示 (Undoなし)
    const label = actionType === "approve" ? "承認しました" : "保留しました";
    showSnackbar(label, "success");

    // 3. API送信 (即時)
    try {
      await apiClient.post("/api/v1/tscore/action", {
        action: actionType,
        targetUserId,
        starId,
      });
      // 成功したら何もしない
    } catch (e) {
      console.error(e);
      // エラー時は戻す
      setItems(previousItems);
      showSnackbar("エラーが発生しました。元に戻します。", "error");
    }
  };

  // --- 否決系 (ここはフィードバック必須なので即時実行のままにするが、完了後はUndoなし) ---

  const startReject = (targetUserId: string, starId: string) => {
    setRejectingTarget(`${targetUserId}-${starId}`);
    setFeedback("");
  };

  const cancelReject = () => {
    setRejectingTarget(null);
    setFeedback("");
  };

  const confirmReject = async (targetUserId: string, starId: string) => {
    if (!feedback.trim()) return;

    // 否決は重い処理なので、楽観的更新ではなくLoading表示で確実に処理する
    try {
      await apiClient.post("/api/v1/tscore/action", {
        action: "reject",
        targetUserId,
        starId,
        feedback,
      });
      setRejectingTarget(null);
      setFeedback("");
      showSnackbar("否決しました", "info");
      await fetchData(); // ここでリスト更新
    } catch (e) {
      console.error(e);
      showSnackbar("エラーが発生しました", "error");
    }
  };

  // ローディング中、または承認・否決作業がない場合は表示しない
  if (loading || items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: "#fff", borderRadius: "28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          maxWidth: "480px", width: "100%", padding: "24px",
          display: "flex", flexDirection: "column", gap: "16px", maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚖️</div>
          <h2 style={{ margin: 0, fontSize: "22px", color: "#1f1f1f", fontWeight: 600 }}>
            スキルの承認・レビュー
          </h2>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#5e5e5e", background: "#f3f4f6", display: "inline-block", padding: "4px 12px", borderRadius: "99px" }}>
            アクティブメンバー: <strong>{stats?.totalUsers ?? "-"}名</strong>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#444746", lineHeight: "1.5" }}>
            承認は「あとで元に戻す」ことができます。<br />
            サクサク判定しましょう！
          </p>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#5e5e5e" }}>読み込み中...</div>
          ) : (
            items.map((userItem) => (
              <div key={userItem.userId}>
                {userItem.pending.map((starId) => {
                  const itemKey = `${userItem.userId}-${starId}`;
                  const isRejecting = rejectingTarget === itemKey;

                  return (
                    <div
                      key={itemKey}
                      style={{
                        border: isRejecting ? "2px solid #b3261e" : "1px solid #e0e2e0",
                        borderRadius: "16px", padding: "16px",
                        display: "flex", flexDirection: "column", gap: "12px",
                        background: isRejecting ? "#fff8f8" : "#fcfcfc",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "12px", color: "#5e5e5e" }}>Applicant</span>
                          <span style={{ fontWeight: "bold", color: "#1f1f1f" }}>{userItem.userName || userNames[userItem.userId] || userItem.userId}</span>
                        </div>
                        <span style={{ fontSize: "12px", padding: "4px 8px", background: "#e0f2fe", color: "#0284c7", borderRadius: "6px", fontWeight: 600 }}>
                          審査中
                        </span>
                      </div>

                      <div style={{ fontSize: "16px", color: "#1f1f1f", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>⭐</span>
                        <b>{starId.replace("star-", "").toUpperCase()}</b>
                      </div>

                      <VoteProgress
                        approvers={userItem.votes?.[starId]?.approvers || []}
                        rejecters={userItem.votes?.[starId]?.rejecters || []}
                        passers={userItem.votes?.[starId]?.passers || []}
                        totalUsers={stats?.totalUsers || 4}
                      />

                      {!isRejecting && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                          <button
                            onClick={() => startReject(userItem.userId, starId)}
                            style={{
                              flex: 1, padding: "10px", borderRadius: "100px",
                              border: "1px solid #747775", background: "transparent",
                              color: "#b3261e", fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            否決...
                          </button>

                          <button
                            onClick={() => handleAction(userItem.userId, starId, "pass")}
                            style={{
                              flex: 1, padding: "10px", borderRadius: "100px",
                              border: "1px solid #747775", background: "transparent",
                              color: "#5e5e5e", fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            保留
                          </button>

                          <button
                            onClick={() => handleAction(userItem.userId, starId, "approve")}
                            style={{
                              flex: 1, padding: "10px", borderRadius: "100px",
                              border: "none", background: "#00639b", color: "#ffffff",
                              fontWeight: 600, cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          >
                            承認
                          </button>
                        </div>
                      )}

                      {isRejecting && (
                        <div style={{ marginTop: "4px", animation: "fadeIn 0.2s" }}>
                          <p style={{ fontSize: "12px", fontWeight: "bold", color: "#b3261e", marginBottom: "4px" }}>
                            否決理由を入力 (本人へ通知):
                          </p>
                          <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="例: 仕上がりにムラがあります。"
                            rows={3}
                            style={{
                              width: "100%", padding: "12px", borderRadius: "8px",
                              border: "1px solid #b3261e", marginBottom: "12px",
                              fontSize: "14px", outline: "none", resize: "vertical",
                            }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={cancelReject}
                              style={{
                                flex: 1, padding: "8px", borderRadius: "8px",
                                border: "none", background: "#e0e2e0", color: "#444746",
                                fontWeight: 600, cursor: "pointer",
                              }}
                            >
                              戻る
                            </button>
                            <button
                              onClick={() => confirmReject(userItem.userId, starId)}
                              disabled={!feedback.trim()}
                              style={{
                                flex: 1, padding: "8px", borderRadius: "8px",
                                border: "none",
                                background: !feedback.trim() ? "#e0e2e0" : "#b3261e",
                                color: !feedback.trim() ? "#8e918f" : "#ffffff",
                                fontWeight: 600, cursor: !feedback.trim() ? "default" : "pointer",
                              }}
                            >
                              否決を確定
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
