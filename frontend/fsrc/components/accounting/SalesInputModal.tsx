import React, { useMemo, useEffect } from "react";
import { useDynamicTheme } from "../../hooks/useDynamicTheme";
import type { Score } from "../../hooks/useLuqoStore";
import { useFileUpload, type AnalysisResult } from "../../hooks/useFileUpload";
import { useSalesForm } from "../../hooks/useSalesForm";
import { useModal } from "../../contexts/ModalContext";
import { FileUploadSection } from "./FileUploadSection";
import { SalesFormSection } from "./SalesFormSection";
import { ExpenseFormSection } from "./ExpenseFormSection";
import styles from "./SalesInputModal.module.css";

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
    onAnalysisSuccess: (data: AnalysisResult) => {
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
          setSuggestedCategories(data.suggestedCategories as Array<{ categoryCode: string; amount: number }>);
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

  const handleRetake = () => {
    setPreviewUrl(null);
    setFileType(null);
    fileInputRef.current?.click();
  };

  const handleApplyTotal = (total: number) => {
    setAmount(String(total));
  };

  return (
    <div className={styles.overlay}>
      <div
        className={`card ${styles.modal} ${isDragging ? styles.dragging : ""} ${step === "success" ? styles.success : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {step === "input" && <div className={styles.backgroundEffect} />}

        <button onClick={handleClose} className={styles.closeButton}>
          ✕
        </button>

        {step === "input" ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* モード切替タブ */}
            <div className={styles.modeTabs}>
              <button
                type="button"
                onClick={() => setMode("sales")}
                className={`${styles.modeTab} ${styles.sales} ${isSales ? styles.active : ""}`}
              >
                売上 (+In)
              </button>
              <button
                type="button"
                onClick={() => setMode("expenses")}
                className={`${styles.modeTab} ${styles.expenses} ${!isSales ? styles.active : ""}`}
              >
                経費 (-Out)
              </button>
            </div>

            {/* ファイルアップロードエリア */}
            <FileUploadSection
              mode={mode}
              analyzing={analyzing}
              analysisStep={analysisStep}
              previewUrl={previewUrl}
              fileType={fileType}
              isDragging={isDragging}
              fileInputRef={fileInputRef}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileSelect={handleFileSelect}
              onRetake={handleRetake}
            />

            {/* 入力フィールド (売上/経費で分岐) */}
            {isSales ? (
              <SalesFormSection
                amount={amount}
                onAmountChange={setAmount}
                clientName={clientName}
                onClientNameChange={setClientName}
                clients={clients}
                selectedCategories={selectedCategories}
                workCategories={workCategories}
                loadingCategories={loadingCategories}
                onToggleCategory={toggleCategorySelection}
                onUpdateCategoryAmount={updateCategoryAmount}
                onRemoveCategory={removeCategory}
              />
            ) : (
              <ExpenseFormSection
                amount={amount}
                onAmountChange={setAmount}
                merchantName={merchantName}
                onMerchantNameChange={setMerchantName}
                category={category}
                onCategoryChange={setCategory}
                items={items}
                onAddItem={addItem}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onApplyTotal={handleApplyTotal}
              />
            )}

            {/* 共通フィールド: 現場名・日付 */}
            <div className={styles.field}>
              <label className={styles.label}>現場名</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="例: 練馬区S邸 リノベーション"
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>日付</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>

            {/* 送信ボタンエリア */}
            <div className={styles.submitArea}>
              {!isSales && (
                <label className={styles.continuousModeLabel}>
                  <input
                    type="checkbox"
                    checked={isContinuous}
                    onChange={(e) => setIsContinuous(e.target.checked)}
                    className={styles.continuousModeCheckbox}
                  />
                  <span className={`${styles.continuousModeText} ${isContinuous ? styles.active : ""}`}>
                    連続スキャンモード (RTA) 🚀
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`${styles.submitButton} ${!isSales ? styles.expenses : ""}`}
              >
                {loading
                  ? "送信中..."
                  : isSales
                  ? "売上を登録"
                  : isContinuous
                  ? "登録して次へ 👉"
                  : "経費を申請"}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>💰</div>
            <h2 className={styles.successPoints}>+{result?.points} Pt</h2>
            <div className={styles.successBadge}>Ops Point Get!</div>
            <div className={styles.successMessage}>
              <div className={styles.successMessageText}>"{result?.message}"</div>
            </div>
            <button onClick={handleClose} className={styles.successCloseButton}>
              閉じる
            </button>
          </div>
        )}

        {burst && <div aria-hidden className={styles.burst} />}
      </div>
    </div>
  );
};
