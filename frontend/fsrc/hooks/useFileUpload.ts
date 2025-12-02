import { useState, useCallback, useRef } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";

type Mode = "sales" | "expenses";

type AnalysisResult = {
    amount?: number;
    date?: string;
    client?: string;
    merchant?: string;
    category?: string;
};

type UseFileUploadProps = {
    mode: Mode;
    onAnalysisSuccess: (data: AnalysisResult) => void;
};

export function useFileUpload({ mode, onAnalysisSuccess }: UseFileUploadProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showSnackbar } = useSnackbar();

    // ファイル処理のコアロジック
    const processFile = async (file: File) => {
        setAnalyzing(true);

        // プレビュー表示の準備
        if (file.type.startsWith("image/")) {
            setFileType("image");
            setPreviewUrl(URL.createObjectURL(file));
        } else if (file.type === "application/pdf") {
            setFileType("pdf");
            setPreviewUrl(null);
        }

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                try {
                    // AI解析APIの呼び出し
                    const res = await apiClient.post<any>("/api/v1/accounting/analyze", {
                        fileBase64: base64,
                        mode,
                    });
                    if (res?.ok && res.analysis) {
                        onAnalysisSuccess(res.analysis);
                        showSnackbar("AI解析完了！内容を確認してください 👀", "success");
                    }
                } catch (err) {
                    console.error(err);
                    showSnackbar("解析に失敗しました", "error");
                } finally {
                    setAnalyzing(false);
                }
            };
        } catch (err) {
            console.error(err);
            showSnackbar("ファイルの読み込みに失敗しました", "error");
            setAnalyzing(false);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return {
        analyzing,
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
