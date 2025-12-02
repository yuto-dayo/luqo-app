import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useDynamicTheme } from "../../hooks/useDynamicTheme";
import type { Score } from "../../hooks/useLuqoStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useSalesForm } from "../../hooks/useSalesForm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

// テーマ定義 (モーダル用の一時的なテーマ)
const pastelTheme: Score = {
  LU: 0, Q: 0, O: 0, total: 0,
  ui: {
    headline: "", greeting: "", color: "#a855f7", icon: "money",
    theme: { color: "#a855f7", shape: "rounded", radiusLevel: 90, vibe: "energetic" },
  },
};

export const SalesInputModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  // 1. フォームロジックの取得
  const {
    step, setStep, mode, setMode,
    amount, setAmount, clientName, setClientName,
    merchantName, setMerchantName, category, setCategory,
    date, setDate, siteName, setSiteName,
    loading, result, burst, isContinuous, setIsContinuous,
    clients, handleSubmit, resetForm
  } = useSalesForm({ isOpen, onSuccess });

  // 2. ファイルアップロードロジックの取得
  // 解析完了時のコールバックをここで注入
  const {
    analyzing, previewUrl, fileType, isDragging, fileInputRef,
    onDragOver, onDragLeave, onDrop, handleFileSelect, resetFileState,
    setPreviewUrl, setFileType
  } = useFileUpload({
    mode,
    onAnalysisSuccess: (data) => {
      if (data.amount) setAmount(String(data.amount));
      if (data.date) setDate(data.date);
      if (mode === "sales") {
        if (data.client) setClientName(data.client);
      } else {
        if (data.merchant) setMerchantName(data.merchant);
        if (data.category) setCategory(data.category);
      }
    },
  });

  // テーマ適用
  const themeSeed = useMemo(() => {
    const seed = pastelTheme.ui.theme.color;
    return { seed, softBg: `linear-gradient(145deg, ${seed}1a, #e0f2fe)` };
  }, []);
  useDynamicTheme(pastelTheme);

  // 閉じる処理
  const handleClose = () => {
    resetForm();
    resetFileState();
    setMode("sales");
    setStep("input");
    onClose();
  };

  if (!isOpen) return null;

  // UI用の変数
  const isSales = mode === "sales";
  const themeColor = isSales ? "#0f172a" : "#b91c1c";
  const surfaceBg = isSales ? themeSeed.softBg : "linear-gradient(145deg, #fff1f2, #fee2e2)";
  const canSubmit = !loading && Number(amount) > 0 && !!date && (isSales ? !!clientName.trim() : !!merchantName.trim());

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(9, 9, 34, 0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
    >
      <div
        className="card"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          width: "100%", maxWidth: "420px", minHeight: "600px", padding: "32px",
          borderRadius: "28px", background: step === "success" ? "#f0fdf4" : surfaceBg,
          boxShadow: "0 28px 80px -24px rgba(0,0,0,0.35)",
          transition: "all 0.4s ease", position: "relative", overflow: "hidden",
          border: isDragging ? `3px dashed ${themeColor}` : "1px solid rgba(255,255,255,0.5)",
          display: "flex", flexDirection: "column", transform: isDragging ? "scale(1.02)" : "scale(1)",
        }}
      >
        {/* 背景エフェクト */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: step === "input" ? "radial-gradient(circle at 20% 10%, #fff6 0%, transparent 35%)" : "none" }} />

        {/* 閉じるボタン */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 20,
            background: "rgba(255,255,255,0.8)", border: "none", cursor: "pointer",
            padding: 10, borderRadius: "50%", color: "#0f172a", boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
          }}
        >
          ✕
        </button>

        {step === "input" ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>

            {/* モード切替タブ */}
            <div style={{ display: "flex", background: "rgba(241,245,249,0.9)", padding: "4px", borderRadius: "99px", gap: "6px" }}>
              <button type="button" onClick={() => setMode("sales")} style={{ flex: 1, padding: "12px", borderRadius: "99px", border: "none", background: isSales ? "#fff" : "transparent", color: isSales ? "#0f172a" : "#64748b", fontWeight: 800, boxShadow: isSales ? "0 2px 8px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s ease", cursor: "pointer" }}>売上 (+In)</button>
              <button type="button" onClick={() => setMode("expenses")} style={{ flex: 1, padding: "12px", borderRadius: "99px", border: "none", background: !isSales ? "#fff" : "transparent", color: !isSales ? "#b91c1c" : "#64748b", fontWeight: 800, boxShadow: !isSales ? "0 2px 8px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s ease", cursor: "pointer" }}>経費 (-Out)</button>
            </div>

            {/* ファイルアップロードエリア */}
            <div style={{ marginBottom: -8 }}>
              <input type="file" accept="image/*,application/pdf" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
              {previewUrl || fileType === "pdf" ? (
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <div style={{ height: "120px", width: "100%", borderRadius: "16px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    {fileType === "image" && previewUrl ? (
                      <img src={previewUrl} alt="Receipt" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <div style={{ textAlign: "center", color: "#64748b" }}><Icon name="info" size={32} /><div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>PDF Document</div></div>
                    )}
                  </div>
                  <button type="button" onClick={() => { setPreviewUrl(null); setFileType(null); fileInputRef.current?.click(); }} style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "white", border: "none", padding: "6px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>撮り直す</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={analyzing} style={{ width: "100%", padding: "16px", borderRadius: "16px", border: `2px dashed ${isSales ? "#cbd5e1" : "#fca5a5"}`, background: analyzing ? (isSales ? "#f1f5f9" : "#fff1f2") : "rgba(255,255,255,0.6)", color: isSales ? "#475569" : "#b91c1c", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }}>
                  {analyzing ? <><span className="spinner" style={{ borderColor: isSales ? "#475569" : "#b91c1c", borderTopColor: "transparent" }} />AI解析中...</> : <><Icon name="ai" size={20} />{isSales ? "請求書/PDFを読込 (AI)" : "レシートを読込 (AI)"}</>}
                </button>
              )}
              {!previewUrl && !analyzing && <div style={{ textAlign: "center", fontSize: "10px", color: "#94a3b8", marginTop: 4 }}>またはファイルをここにドロップ</div>}
            </div>

            {/* 金額入力 */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>金額 (税抜)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: "22px", color: "#94a3b8", fontWeight: 700 }}>¥</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus style={{ width: "100%", fontSize: "36px", fontWeight: 800, padding: "14px 14px 14px 44px", borderRadius: "18px", border: `2px solid ${isSales ? "#e2e8f0" : "#fecdd3"}`, background: isSales ? "#f8fafc" : "#fff1f2", outline: "none", textAlign: "right", letterSpacing: "-1px", color: themeColor }} />
              </div>
            </div>

            {/* 入力フィールド (売上/経費で分岐) */}
            {isSales ? (
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>取引先</label>
                  <select value={clientName} onChange={(e) => setClientName(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "14px", outline: "none" }}>
                    <option value="" disabled>選択してください</option>
                    {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <div style={{ textAlign: "right", marginTop: 4 }}><a href="/settings" style={{ fontSize: 10, color: "#2563eb", textDecoration: "none" }}>＋ 設定で追加する</a></div>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>支払先 (店名)</label>
                  <input type="text" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="例: コーナンPro" style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", fontSize: "14px", outline: "none" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>科目</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "14px" }}>
                    <option value="material">🛠️ 材料費</option>
                    <option value="tool">🪚 工具器具</option>
                    <option value="travel">🚕 旅費交通費</option>
                    <option value="food">🍱 会議費/飲食</option>
                    <option value="other">📦 その他</option>
                  </select>
                </div>
              </div>
            )}

            {/* 共通フィールド: 現場名・日付 */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>現場名</label>
              <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="例: 練馬区S邸 リノベーション" style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", fontSize: "14px", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>日付</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", fontSize: "14px", outline: "none" }} />
            </div>

            {/* 送信ボタンエリア */}
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              {!isSales && (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={isContinuous} onChange={(e) => setIsContinuous(e.target.checked)} style={{ accentColor: "#b91c1c", width: 16, height: 16 }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: isContinuous ? "#b91c1c" : "#64748b" }}>連続スキャンモード (RTA) 🚀</span>
                </label>
              )}
              <button type="submit" disabled={!canSubmit} style={{ width: "100%", padding: "16px", fontSize: "16px", fontWeight: 800, borderRadius: "999px", background: loading ? "#cbd5e1" : themeColor, color: "white", border: "none", cursor: loading || !canSubmit ? "not-allowed" : "pointer", boxShadow: "0 12px 20px -10px rgba(15, 23, 42, 0.35)", transition: "transform 0.2s ease" }}>
                {loading ? "送信中..." : isSales ? "売上を登録" : isContinuous ? "登録して次へ 👉" : "経費を申請"}
              </button>
            </div>
          </form>
        ) : (
          /* 完了画面 */
          <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
            <div style={{ fontSize: "64px", marginBottom: "16px", animation: "bounce 1s infinite" }}>💰</div>
            <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#15803d", margin: "0 0 8px" }}>+{result?.points} Pt</h2>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#15803d", background: "#dcfce7", display: "inline-block", padding: "6px 14px", borderRadius: 99, marginBottom: "40px" }}>Ops Point Get!</div>
            <div style={{ background: "rgba(255,255,255,0.7)", padding: "24px", borderRadius: "24px", marginBottom: "32px", boxShadow: "0 8px 16px -12px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: "16px", color: "#0f172a", lineHeight: "1.6", fontWeight: 500 }}>"{result?.message}"</div>
            </div>
            <button onClick={handleClose} style={{ background: "#15803d", color: "white", border: "none", padding: "16px 48px", borderRadius: "100px", fontSize: "16px", fontWeight: 800, cursor: "pointer", boxShadow: "0 10px 20px -12px rgba(21, 128, 61, 0.4)", width: "100%" }}>閉じる</button>
          </div>
        )}

        {burst && <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)", animation: "ping 0.8s cubic-bezier(0, 0, 0.2, 1)" }} />}
      </div>
      <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } } @keyframes ping { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } } .spinner { width: 16px; height: 16px; border: 2px solid #cbd5e1; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
