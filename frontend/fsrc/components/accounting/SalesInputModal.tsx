import React, { useMemo, useEffect } from "react";
import { Icon } from "../ui/Icon";
import { useDynamicTheme } from "../../hooks/useDynamicTheme";
import type { Score } from "../../hooks/useLuqoStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useSalesForm } from "../../hooks/useSalesForm";
import { useModal } from "../../contexts/ModalContext";

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
  // モーダル状態の管理（FABの非表示制御のため）
  const { registerModal } = useModal();
  
  useEffect(() => {
    if (isOpen) {
      const unregister = registerModal("sales-input-modal");
      return unregister;
    }
  }, [isOpen, registerModal]);

  // 1. フォームロジックの取得
  const {
    step, setStep, mode, setMode,
    amount, setAmount, clientName, setClientName,
    merchantName, setMerchantName, category, setCategory,
    date, setDate, siteName, setSiteName,
    items, setItems, addItem, updateItem, removeItem,
    loading, result, burst, isContinuous, setIsContinuous,
    clients, handleSubmit, resetForm,
    // 工事カテゴリ関連（複数選択対応）
    selectedCategories, toggleCategorySelection, updateCategoryAmount, removeCategory,
    workCategories, loadingCategories,
    setSuggestedCategory, setSuggestedCategories
  } = useSalesForm({ isOpen, onSuccess });

  // 2. ファイルアップロードロジックの取得
  // 解析完了時のコールバックをここで注入
  const {
    analyzing, analysisStep, previewUrl, fileType, isDragging, fileInputRef,
    onDragOver, onDragLeave, onDrop, handleFileSelect, resetFileState,
    setPreviewUrl, setFileType
  } = useFileUpload({
    mode,
    onAnalysisSuccess: (data) => {
      // デバッグ: 受け取ったデータをログ出力
      console.log("[SalesInputModal] 解析データを受け取り:", data);
      
      if (data.amount) setAmount(String(data.amount));
      if (data.date) setDate(data.date);
      // 現場名は売上・経費の両方で反映（複数のキー名に対応）
      if (data.siteName) {
        setSiteName(data.siteName);
        console.log("[SalesInputModal] 現場名を設定:", data.siteName);
      } else if (data.site) {
        // 別のキー名の可能性にも対応
        setSiteName(data.site);
        console.log("[SalesInputModal] 現場名を設定（siteキー）:", data.site);
      }
      if (mode === "sales") {
        if (data.client) {
          setClientName(data.client);
          console.log("[SalesInputModal] 取引先名を設定:", data.client);
        } else if (data.clientName) {
          // 別のキー名の可能性にも対応
          setClientName(data.clientName);
          console.log("[SalesInputModal] 取引先名を設定（clientNameキー）:", data.clientName);
        }
        // AIからの推奨カテゴリを設定（複数カテゴリ対応）
        if (data.suggestedCategories && Array.isArray(data.suggestedCategories) && data.suggestedCategories.length > 0) {
          // 複数カテゴリが検出された場合
          console.log("[SalesInputModal] 複数推奨カテゴリを設定:", data.suggestedCategories);
          // 複数カテゴリと金額のペアを設定
          setSuggestedCategories(data.suggestedCategories);
        } else if (data.suggestedCategory) {
          // 単一カテゴリの場合（後方互換性）
          console.log("[SalesInputModal] 推奨カテゴリを設定:", data.suggestedCategory);
          setSuggestedCategory(data.suggestedCategory);
        }
      } else {
        if (data.merchant) setMerchantName(data.merchant);
        if (data.category) setCategory(data.category);
        // OCRで品名が解析された場合は自動的に設定
        if (data.items && data.items.length > 0) {
          setItems(data.items);
        }
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
  // バリデーション: カテゴリが選択されている場合は、各カテゴリに金額が入力されているかチェック
  const hasValidCategoryAmounts = selectedCategories.length === 0 || 
    selectedCategories.some(sc => {
      const catAmount = Number(sc.amount);
      return Number.isFinite(catAmount) && catAmount > 0;
    });
  const canSubmit = !loading && 
    ((isSales && selectedCategories.length > 0) ? hasValidCategoryAmounts : Number(amount) > 0) &&
    !!date && 
    (isSales ? !!clientName.trim() : !!merchantName.trim());

  return (
    <div
      className="sales-modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(9, 9, 34, 0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", 
        padding: "16px",
        paddingTop: "calc(var(--header-height) + 16px)",
        overflowY: "auto",
      }}
    >
      <div
        className="card"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "90vh", padding: "32px",
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
          <form onSubmit={handleSubmit} className="sales-modal-form" style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1, overflowY: "auto", minHeight: 0 }}>

            {/* モード切替タブ */}
            <div style={{ display: "flex", background: "rgba(241,245,249,0.9)", padding: "4px", borderRadius: "99px", gap: "6px" }}>
              <button type="button" onClick={() => setMode("sales")} style={{ flex: 1, padding: "12px", borderRadius: "99px", border: "none", background: isSales ? "#fff" : "transparent", color: isSales ? "#0f172a" : "#64748b", fontWeight: 800, boxShadow: isSales ? "0 2px 8px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s ease", cursor: "pointer" }}>売上 (+In)</button>
              <button type="button" onClick={() => setMode("expenses")} style={{ flex: 1, padding: "12px", borderRadius: "99px", border: "none", background: !isSales ? "#fff" : "transparent", color: !isSales ? "#b91c1c" : "#64748b", fontWeight: 800, boxShadow: !isSales ? "0 2px 8px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s ease", cursor: "pointer" }}>経費 (-Out)</button>
            </div>

            {/* ファイルアップロードエリア */}
            <div style={{ marginBottom: -8 }}>
              <input type="file" accept="image/*,application/pdf" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
              {previewUrl || fileType === "pdf" || analyzing ? (
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <div style={{ 
                    height: "120px", 
                    width: "100%", 
                    borderRadius: "16px", 
                    background: analyzing ? (isSales ? "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)" : "linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)") : "#f1f5f9", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    overflow: "hidden", 
                    border: analyzing ? `2px solid ${isSales ? "#475569" : "#b91c1c"}` : "1px solid #e2e8f0",
                    position: "relative",
                    animation: analyzing ? "pulse 2s ease-in-out infinite" : "none",
                  }}>
                    {analyzing ? (
                      // 解析中の表示
                      <div style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        gap: "12px",
                        zIndex: 10,
                        position: "relative",
                      }}>
                        <div style={{ 
                          width: "48px", 
                          height: "48px", 
                          borderRadius: "50%", 
                          background: `linear-gradient(135deg, ${isSales ? "#475569" : "#b91c1c"}, ${isSales ? "#64748b" : "#dc2626"})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          animation: "spin 1s linear infinite",
                          boxShadow: `0 0 20px rgba(${isSales ? "71, 85, 105" : "185, 28, 28"}, 0.4)`,
                        }}>
                          <Icon name="ai" size={24} color="white" />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ 
                            fontSize: "14px", 
                            fontWeight: 800, 
                            color: isSales ? "#475569" : "#b91c1c",
                            marginBottom: "4px",
                          }}>
                            {analysisStep === "uploading" && "📤 ファイル読み込み中..."}
                            {analysisStep === "converting" && "🔄 PDF変換中..."}
                            {analysisStep === "analyzing" && "🤖 AI解析中..."}
                            {analysisStep === "complete" && "✅ 解析完了！"}
                          </div>
                          <div style={{ 
                            fontSize: "11px", 
                            color: "#64748b",
                            fontWeight: 500,
                          }}>
                            {analysisStep === "uploading" && "ファイルを確認しています"}
                            {analysisStep === "converting" && "PDFを画像に変換しています"}
                            {analysisStep === "analyzing" && "AIが金額や店名を読み取っています"}
                            {analysisStep === "complete" && "結果を確認してください"}
                          </div>
                        </div>
                        {/* プログレスバー */}
                        <div style={{
                          width: "200px",
                          height: "4px",
                          background: "#e2e8f0",
                          borderRadius: "2px",
                          overflow: "hidden",
                          position: "relative",
                        }}>
                          <div style={{
                            height: "100%",
                            width: analysisStep === "uploading" ? "25%" : analysisStep === "converting" ? "50%" : analysisStep === "analyzing" ? "75%" : "100%",
                            background: analysisStep === "analyzing" 
                              ? `linear-gradient(90deg, ${isSales ? "#475569" : "#b91c1c"} 0%, ${isSales ? "#64748b" : "#dc2626"} 50%, ${isSales ? "#475569" : "#b91c1c"} 100%)`
                              : `linear-gradient(90deg, ${isSales ? "#475569" : "#b91c1c"}, ${isSales ? "#64748b" : "#dc2626"})`,
                            backgroundSize: analysisStep === "analyzing" ? "200% 100%" : "100% 100%",
                            borderRadius: "2px",
                            transition: "width 0.3s ease",
                            animation: analysisStep === "analyzing" ? "shimmer 1.5s ease-in-out infinite" : "none",
                          }} />
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <img src={previewUrl} alt={fileType === "pdf" ? "PDF Document" : "Receipt"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <div style={{ textAlign: "center", color: "#64748b" }}><Icon name="info" size={32} /><div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>PDF Document</div></div>
                    )}
                    {/* 解析中の背景エフェクト */}
                    {analyzing && (
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        background: `radial-gradient(circle at center, rgba(${isSales ? "71, 85, 105" : "185, 28, 28"}, 0.1) 0%, transparent 70%)`,
                        animation: "pulse-glow 2s ease-in-out infinite",
                        pointerEvents: "none",
                      }} />
                    )}
                  </div>
                  {!analyzing && (
                    <button type="button" onClick={() => { setPreviewUrl(null); setFileType(null); fileInputRef.current?.click(); }} style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "white", border: "none", padding: "6px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>撮り直す</button>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={analyzing} style={{ width: "100%", padding: "16px", borderRadius: "16px", border: `2px dashed ${isSales ? "#cbd5e1" : "#fca5a5"}`, background: analyzing ? (isSales ? "#f1f5f9" : "#fff1f2") : "rgba(255,255,255,0.6)", color: isSales ? "#475569" : "#b91c1c", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }}>
                  {analyzing ? <><span className="spinner" style={{ borderColor: isSales ? "#475569" : "#b91c1c", borderTopColor: "transparent" }} />AI解析中...</> : <><Icon name="ai" size={20} />{isSales ? "請求書/PDFを読込 (AI)" : "レシートを読込 (AI)"}</>}
                </button>
              )}
              {!previewUrl && !analyzing && <div style={{ textAlign: "center", fontSize: "10px", color: "#94a3b8", marginTop: 4 }}>またはファイルをここにドロップ</div>}
            </div>

            {/* 金額入力（カテゴリが選択されていない場合のみ表示） */}
            {isSales && selectedCategories.length === 0 && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>金額 (税抜)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: "22px", color: "#94a3b8", fontWeight: 700 }}>¥</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus style={{ width: "100%", fontSize: "36px", fontWeight: 800, padding: "14px 14px 14px 44px", borderRadius: "18px", border: `2px solid ${isSales ? "#e2e8f0" : "#fecdd3"}`, background: isSales ? "#f8fafc" : "#fff1f2", outline: "none", textAlign: "right", letterSpacing: "-1px", color: themeColor }} />
                </div>
              </div>
            )}
            {!isSales && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>金額 (税抜)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: "22px", color: "#94a3b8", fontWeight: 700 }}>¥</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus style={{ width: "100%", fontSize: "36px", fontWeight: 800, padding: "14px 14px 14px 44px", borderRadius: "18px", border: `2px solid ${isSales ? "#e2e8f0" : "#fecdd3"}`, background: isSales ? "#f8fafc" : "#fff1f2", outline: "none", textAlign: "right", letterSpacing: "-1px", color: themeColor }} />
                </div>
              </div>
            )}

            {/* 入力フィールド (売上/経費で分岐) */}
            {isSales ? (
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>取引先</label>
                  <select value={clientName} onChange={(e) => setClientName(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "14px", outline: "none" }}>
                    <option value="" disabled>選択してください</option>
                    {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <div style={{ textAlign: "right", marginTop: 4 }}><a href="/settings" style={{ fontSize: 10, color: "#2563eb", textDecoration: "none" }}>＋ 設定で追加する</a></div>
                </div>

                {/* 工事カテゴリ選択（複数選択対応） */}
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>
                    工事カテゴリ
                    <span style={{ fontWeight: 400, color: "#64748b", marginLeft: 4 }}>(任意)</span>
                  </label>
                  {/* 複数選択可能なカテゴリリスト */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      background: "#fff",
                      maxHeight: "200px",
                      overflowY: "auto",
                      padding: "8px",
                    }}
                  >
                    {loadingCategories ? (
                      <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                        読み込み中...
                      </div>
                    ) : workCategories.length === 0 ? (
                      <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                        カテゴリが登録されていません
                      </div>
                    ) : (
                      workCategories.map((cat) => {
                        const isSelected = selectedCategories.some(sc => sc.id === cat.id);
                        return (
                          <label
                            key={cat.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "10px 12px",
                              borderRadius: "10px",
                              cursor: "pointer",
                              background: isSelected ? "#f8fafc" : "transparent",
                              border: isSelected ? "1px solid #0f172a" : "1px solid transparent",
                              marginBottom: "4px",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "#f8fafc";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "transparent";
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCategorySelection(cat.id)}
                              style={{
                                width: "18px",
                                height: "18px",
                                marginRight: "10px",
                                cursor: "pointer",
                                accentColor: "#0f172a",
                              }}
                            />
                            <span style={{ fontSize: "14px", fontWeight: isSelected ? 700 : 500, color: "#1e293b", flex: 1 }}>
                              {cat.label}
                              {cat.defaultWeight !== 1.0 && (
                                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px" }}>
                                  (×{cat.defaultWeight.toFixed(1)})
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  
                  {/* 選択されたカテゴリごとの金額入力フィールド */}
                  {selectedCategories.length > 0 && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {selectedCategories.map((selectedCat) => (
                        <div
                          key={selectedCat.id}
                          style={{
                            padding: "12px",
                            borderRadius: "12px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                            <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                              {selectedCat.label} の金額
                            </label>
                            <button
                              type="button"
                              onClick={() => removeCategory(selectedCat.id)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                background: "#fff",
                                color: "#64748b",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              削除
                            </button>
                          </div>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "#94a3b8", fontWeight: 700 }}>¥</span>
                            <input
                              type="number"
                              value={selectedCat.amount}
                              onChange={(e) => updateCategoryAmount(selectedCat.id, e.target.value)}
                              placeholder="0"
                              style={{
                                width: "100%",
                                fontSize: "24px",
                                fontWeight: 800,
                                padding: "10px 10px 10px 36px",
                                borderRadius: "10px",
                                border: selectedCat.amount ? "2px solid #0f172a" : "1px solid #e2e8f0",
                                background: "#fff",
                                outline: "none",
                                textAlign: "right",
                                letterSpacing: "-1px",
                                color: "#0f172a",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: "4px", fontSize: 10, color: "#1e293b", fontWeight: 500 }}>
                        選択したカテゴリの売上はTScore計算に反映されます
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>支払先 (店名)</label>
                  <input type="text" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="例: コーナンPro" style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", fontSize: "14px", outline: "none" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>科目</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "14px" }}>
                    <option value="material">🛠️ 材料費</option>
                    <option value="tool">🪚 工具器具</option>
                    <option value="travel">🚕 旅費交通費</option>
                    <option value="food">🍱 会議費/飲食</option>
                    <option value="other">📦 その他</option>
                  </select>
                </div>
                
                {/* 品名リスト */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block" }}>品名（何を買ったか）</label>
                    <button
                      type="button"
                      onClick={addItem}
                      style={{
                        background: "#b91c1c",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: 700,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                    >
                      +
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <div style={{ padding: "12px", borderRadius: "12px", border: "1px dashed #e2e8f0", background: "#f8fafc", color: "#94a3b8", fontSize: "12px", textAlign: "center" }}>
                      プラスボタンで品名を追加
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {items.map((item, index) => {
                        // 小計を計算（数量 × 単価）
                        const quantity = item.quantity || 1;
                        const unitPrice = item.unitPrice || 0;
                        const subtotal = quantity * unitPrice;
                        
                        return (
                          <div key={index} style={{ 
                            padding: "12px", 
                            borderRadius: "12px", 
                            border: "1px solid #e2e8f0", 
                            background: "#fff",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                          }}>
                            {/* 品名と削除ボタン */}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(index, "name", e.target.value)}
                                placeholder="例: ビス 3.5×25"
                                style={{
                                  flex: 1,
                                  padding: "10px",
                                  borderRadius: "10px",
                                  border: "1px solid #e2e8f0",
                                  background: "#fff",
                                  fontSize: "13px",
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                style={{
                                  background: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "8px",
                                  width: "32px",
                                  height: "32px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                ×
                              </button>
                            </div>
                            
                            {/* 数量・単価・小計 */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", alignItems: "end" }}>
                              <div>
                                <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>数量</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity || ""}
                                  onChange={(e) => updateItem(index, "quantity", e.target.value ? Number(e.target.value) : undefined)}
                                  placeholder="1"
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "8px",
                                    border: "1px solid #e2e8f0",
                                    background: "#fff",
                                    fontSize: "13px",
                                    outline: "none",
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>単価 (¥)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.unitPrice || ""}
                                  onChange={(e) => updateItem(index, "unitPrice", e.target.value ? Number(e.target.value) : undefined)}
                                  placeholder="0"
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "8px",
                                    border: "1px solid #e2e8f0",
                                    background: "#fff",
                                    fontSize: "13px",
                                    outline: "none",
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>小計</label>
                                <div style={{
                                  width: "100%",
                                  padding: "8px",
                                  borderRadius: "8px",
                                  border: "1px solid #e2e8f0",
                                  background: "#f8fafc",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: "#b91c1c",
                                  textAlign: "right",
                                }}>
                                  ¥{subtotal.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* 品名合計（参考表示） */}
                      {items.length > 0 && (() => {
                        const itemsTotal = items.reduce((sum, item) => {
                          const qty = item.quantity || 1;
                          const price = item.unitPrice || 0;
                          return sum + (qty * price);
                        }, 0);
                        const amountNum = Number(amount) || 0;
                        const hasDifference = Math.abs(itemsTotal - amountNum) > 1; // 1円以上の差がある場合
                        
                        return (
                          <div style={{
                            marginTop: "4px",
                            padding: "12px",
                            borderRadius: "12px",
                            background: hasDifference ? "linear-gradient(145deg, #fef3c7, #fde68a)" : "linear-gradient(145deg, #f0f9ff, #e0f2fe)",
                            border: hasDifference ? "2px solid #fbbf24" : "2px solid #bfdbfe",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, color: hasDifference ? "#92400e" : "#1e40af" }}>
                                  品名合計（参考）
                                </span>
                                {hasDifference && (
                                  <span style={{ fontSize: "9px", color: "#92400e", fontWeight: 500 }}>
                                    金額（税抜）と不一致
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "16px", fontWeight: 800, color: hasDifference ? "#92400e" : "#1e40af" }}>
                                  ¥{itemsTotal.toLocaleString()}
                                </span>
                                {hasDifference && (
                                  <button
                                    type="button"
                                    onClick={() => setAmount(String(itemsTotal))}
                                    style={{
                                      background: "#3b82f6",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      padding: "4px 10px",
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    反映
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ fontSize: "10px", color: hasDifference ? "#92400e" : "#1e40af", fontWeight: 500 }}>
                              ※ 金額（税抜）フィールドが優先されます。税込金額を入力する場合は、品名合計と異なる場合があります。
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 共通フィールド: 現場名・日付 */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>現場名</label>
              <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="例: 練馬区S邸 リノベーション" style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", fontSize: "14px", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>日付</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "14px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", fontSize: "14px", outline: "none" }} />
            </div>

            {/* 送信ボタンエリア */}
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
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
      <style>{`
        /* スクロールバーを非表示（スクロール機能は維持） */
        .sales-modal-overlay::-webkit-scrollbar,
        .sales-modal-form::-webkit-scrollbar {
          display: none;
        }
        .sales-modal-overlay,
        .sales-modal-form {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        
        @keyframes bounce { 
          0%, 100% { transform: translateY(0); } 
          50% { transform: translateY(-10px); } 
        } 
        @keyframes ping { 
          0% { transform: scale(0.8); opacity: 0.8; } 
          100% { transform: scale(1.5); opacity: 0; } 
        } 
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(71, 85, 105, 0.4);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(71, 85, 105, 0);
          }
        }
        @keyframes pulse-glow {
          0%, 100% { 
            opacity: 0.3;
          }
          50% { 
            opacity: 0.6;
          }
        }
        @keyframes shimmer {
          0% { 
            background-position: -200px 0;
          }
          100% { 
            background-position: 200px 0;
          }
        }
        .spinner { 
          width: 16px; 
          height: 16px; 
          border: 2px solid #cbd5e1; 
          border-top-color: transparent; 
          border-radius: 50%; 
          animation: spin 0.8s linear infinite; 
        }
      `}</style>
    </div>
  );
};
