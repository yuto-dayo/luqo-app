import { useState, useCallback, useRef, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";
import * as pdfjsLib from "pdfjs-dist";

// PDF.jsのワーカーを設定（Vite対応）
// Viteの?urlインポートを使用してワーカーファイルを読み込む
let workerSrcSet = false;

function setPdfWorker() {
  if (typeof window === "undefined" || workerSrcSet) {
    return;
  }
  
  // 複数のパスを試行（.jsと.mjsの両方）
  const workerPaths = [
    "/pdfjs/pdf.worker.min.js",  // .jsファイルを優先
    "/pdfjs/pdf.worker.min.mjs", // .mjsファイル
  ];
  
  // まずは.jsファイルを試す（ブラウザ互換性が高い）
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPaths[0];
  workerSrcSet = true;
  console.log("PDF.js worker set to:", pdfjsLib.GlobalWorkerOptions.workerSrc);
}

// コンポーネントのマウント時に実行
if (typeof window !== "undefined") {
  setPdfWorker();
}

type Mode = "sales" | "expenses";

type AnalysisResult = {
    amount?: number;
    date?: string;
    client?: string;
    merchant?: string;
    category?: string;
    siteName?: string; // 現場名
    items?: Array<{ name: string; quantity?: number; unitPrice?: number }>; // 品名リスト
};

type UseFileUploadProps = {
    mode: Mode;
    onAnalysisSuccess: (data: AnalysisResult) => void;
};

// PDFを画像に変換する関数
async function convertPdfToImage(file: File): Promise<string> {
    try {
        // ファイルサイズチェック（10MB制限）
        if (file.size > 10 * 1024 * 1024) {
            throw new Error("PDFファイルが大きすぎます（10MB以下にしてください）");
        }
        
        const arrayBuffer = await file.arrayBuffer();
        
        // PDF.jsでドキュメントを読み込む
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            verbosity: 0, // エラーログを抑制
        });
        
        const pdf = await loadingTask.promise;
        
        // ページ数の確認
        if (pdf.numPages === 0) {
            throw new Error("PDFにページが含まれていません");
        }
        
        // 最初のページを取得
        const page = await pdf.getPage(1);
        
        // レンダリング用のスケールを設定（高解像度で）
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        
        if (!context) {
            throw new Error("Canvas context could not be created");
        }
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // PDFページを画像としてレンダリング
        const renderContext = {
            canvasContext: context,
            viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        
        // Canvasをbase64画像に変換
        const imageDataUrl = canvas.toDataURL("image/png");
        
        if (!imageDataUrl || imageDataUrl === "data:,") {
            throw new Error("画像の変換に失敗しました");
        }
        
        return imageDataUrl;
    } catch (error: any) {
        // より詳細なエラーメッセージを提供
        const errorMessage = error?.message || "PDFの変換に失敗しました";
        console.error("PDF変換エラー詳細:", {
            message: errorMessage,
            name: error?.name,
            stack: error?.stack,
            fileSize: file.size,
            fileName: file.name,
        });
        throw new Error(errorMessage);
    }
}

type AnalysisStep = "idle" | "uploading" | "converting" | "analyzing" | "complete";

export function useFileUpload({ mode, onAnalysisSuccess }: UseFileUploadProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState<AnalysisStep>("idle");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showSnackbar } = useSnackbar();
    
    // PDF.jsワーカーの初期化を確認
    useEffect(() => {
        if (!workerSrcSet) {
            setPdfWorker();
        }
    }, []);

    // ファイル処理のコアロジック
    const processFile = async (file: File) => {
        setAnalyzing(true);
        setAnalysisStep("uploading");

        try {
            let base64: string;
            
            if (file.type.startsWith("image/")) {
                // 画像ファイルの場合
                setFileType("image");
                const imageUrl = URL.createObjectURL(file);
                setPreviewUrl(imageUrl);
                
                // 画像をbase64に変換
                const reader = new FileReader();
                base64 = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            } else if (file.type === "application/pdf") {
                // PDFファイルの場合
                setFileType("pdf");
                setPreviewUrl(null);
                setAnalysisStep("converting");
                
                try {
                    // PDFを画像に変換
                    base64 = await convertPdfToImage(file);
                    // 変換後の画像をプレビューに表示
                    setPreviewUrl(base64);
                } catch (err: any) {
                    console.error("PDF変換エラー:", err);
                    // より詳細なエラーメッセージを表示
                    const errorMessage = err?.message || "PDFの変換に失敗しました";
                    showSnackbar(errorMessage, "error");
                    setAnalyzing(false);
                    setAnalysisStep("idle");
                    setFileType(null);
                    setPreviewUrl(null);
                    return;
                }
            } else {
                showSnackbar("サポートされていないファイル形式です", "error");
                setAnalyzing(false);
                setAnalysisStep("idle");
                return;
            }
            
            // AI解析APIの呼び出し
            setAnalysisStep("analyzing");
            try {
                const res = await apiClient.post<any>("/api/v1/accounting/analyze", {
                    fileBase64: base64,
                    mode,
                });
                if (res?.ok && res.analysis) {
                    setAnalysisStep("complete");
                    // デバッグ: 解析結果をログ出力
                    console.log("[FileUpload] 解析結果:", res.analysis);
                    onAnalysisSuccess(res.analysis);
                    showSnackbar("AI解析完了！内容を確認してください 👀", "success");
                    // 完了状態を少し表示してからidleに戻す
                    setTimeout(() => setAnalysisStep("idle"), 1000);
                } else {
                    // レスポンスは成功したが、解析結果がない場合
                    showSnackbar("解析結果が取得できませんでした", "error");
                    setAnalysisStep("idle");
                }
            } catch (err: any) {
                console.error("解析エラー:", err);
                // サーバーからのエラーメッセージを取得
                let errorMessage = "解析に失敗しました";
                if (err?.data?.error) {
                    // apiClientから返されたエラーデータを使用
                    errorMessage = err.data.error;
                    if (err.data.details && process.env.NODE_ENV === "development") {
                        console.error("詳細エラー:", err.data.details);
                    }
                } else if (err?.message) {
                    errorMessage = err.message;
                }
                showSnackbar(errorMessage, "error");
                setAnalysisStep("idle");
            } finally {
                setAnalyzing(false);
            }
        } catch (err) {
            console.error(err);
            showSnackbar("ファイルの読み込みに失敗しました", "error");
            setAnalyzing(false);
            setAnalysisStep("idle");
            setPreviewUrl(null);
        }
    };

    // ドラッグ＆ドロップのイベントハンドラ
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
            processFile(file);
        } else {
            showSnackbar("画像またはPDFファイルのみ対応しています", "error");
        }
    }, [mode]); // processFileは内部でmodeを使うため依存に入れるか、関数自体を依存させる

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const resetFileState = () => {
        setPreviewUrl(null);
        setFileType(null);
        setAnalysisStep("idle");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return {
        analyzing,
        analysisStep,
        previewUrl,
        fileType,
        isDragging,
        fileInputRef,
        onDragOver,
        onDragLeave,
        onDrop,
        handleFileSelect,
        resetFileState,
        setPreviewUrl,
        setFileType,
    };
}
