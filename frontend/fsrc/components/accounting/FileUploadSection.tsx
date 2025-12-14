import React from "react";
import { Icon } from "../ui/Icon";
import styles from "./FileUploadSection.module.css";

type Props = {
  mode: "sales" | "expenses";
  analyzing: boolean;
  analysisStep: "idle" | "uploading" | "converting" | "analyzing" | "complete";
  previewUrl: string | null;
  fileType: "image" | "pdf" | null;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetake: () => void;
};

export const FileUploadSection: React.FC<Props> = ({
  mode,
  analyzing,
  analysisStep,
  previewUrl,
  fileType,
  isDragging,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onRetake,
}) => {
  const isSales = mode === "sales";

  return (
    <div className={styles.container}>
      <input
        type="file"
        accept="image/*,application/pdf"
        ref={fileInputRef}
        className={styles.fileInput}
        onChange={onFileSelect}
      />
      {previewUrl || fileType === "pdf" || analyzing ? (
        <div className={styles.previewContainer}>
          <div className={`${styles.preview} ${analyzing ? styles.analyzing : ""}`}>
            {analyzing ? (
              <div className={styles.analyzingContent}>
                <div className={styles.analyzingIcon}>
                  <Icon name="ai" size={24} color="white" />
                </div>
                <div className={styles.analyzingText}>
                  <div className={styles.analyzingTitle}>
                    {analysisStep === "uploading" && "📤 ファイル読み込み中..."}
                    {analysisStep === "converting" && "🔄 PDF変換中..."}
                    {analysisStep === "analyzing" && "🤖 AI解析中..."}
                    {analysisStep === "complete" && "✅ 解析完了！"}
                  </div>
                  <div className={styles.analyzingSubtitle}>
                    {analysisStep === "uploading" && "ファイルを確認しています"}
                    {analysisStep === "converting" && "PDFを画像に変換しています"}
                    {analysisStep === "analyzing" && "AIが金額や店名を読み取っています"}
                    {analysisStep === "complete" && "結果を確認してください"}
                  </div>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={`${styles.progressFill} ${analysisStep === "analyzing" ? styles.analyzing : ""}`}
                    style={{
                      width:
                        analysisStep === "uploading"
                          ? "25%"
                          : analysisStep === "converting"
                          ? "50%"
                          : analysisStep === "analyzing"
                          ? "75%"
                          : "100%",
                    }}
                  />
                </div>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={fileType === "pdf" ? "PDF Document" : "Receipt"}
                className={styles.previewImage}
              />
            ) : (
              <div className={styles.previewPlaceholder}>
                <Icon name="info" size={32} />
                <div className={styles.previewPlaceholderText}>PDF Document</div>
              </div>
            )}
            {analyzing && <div className={styles.analyzingGlow} />}
          </div>
          {!analyzing && (
            <button type="button" onClick={onRetake} className={styles.retakeButton}>
              撮り直す
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className={`${styles.uploadButton} ${isSales ? styles.sales : styles.expenses}`}
        >
          {analyzing ? (
            <>
              <span className={styles.spinner} />
              AI解析中...
            </>
          ) : (
            <>
              <Icon name="ai" size={20} />
              {isSales ? "請求書/PDFを読込 (AI)" : "レシートを読込 (AI)"}
            </>
          )}
        </button>
      )}
      {!previewUrl && !analyzing && (
        <div className={styles.dropHint}>またはファイルをここにドロップ</div>
      )}
    </div>
  );
};
