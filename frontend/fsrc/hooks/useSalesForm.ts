import { useState, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { SalesRegistrationResponse } from "../types/accounting";

type Mode = "sales" | "expenses";
type Client = { id: string; name: string };

type UseSalesFormProps = {
    isOpen: boolean;
    onSuccess: () => void;
};

export function useSalesForm({ isOpen, onSuccess }: UseSalesFormProps) {
    const [step, setStep] = useState<"input" | "success">("input");
    const [mode, setMode] = useState<Mode>("sales");

    // フォームの状態
    const [amount, setAmount] = useState("");
    const [clientName, setClientName] = useState("");
    const [merchantName, setMerchantName] = useState("");
    const [category, setCategory] = useState("material");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [siteName, setSiteName] = useState("");

    // UX/UIの状態
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ points: number; message: string } | null>(null);
    const [burst, setBurst] = useState(false); // 完了時のエフェクト用
    const [isContinuous, setIsContinuous] = useState(false); // 連続入力モード
    const [clients, setClients] = useState<Client[]>([]);

    const { showSnackbar } = useSnackbar();

    // 完了エフェクトのタイマー
    useEffect(() => {
        if (step === "success") {
            setBurst(true);
            const timer = setTimeout(() => setBurst(false), 1600);
            return () => clearTimeout(timer);
        }
    }, [step]);

    // 取引先マスタの取得
    useEffect(() => {
        if (!isOpen) return;
        apiClient
            .get<{ clients: Client[] }>("/api/v1/master/clients")
            .then((res) => setClients(res.clients || []))
            .catch((err) => {
                console.error("Failed to load clients", err);
            });
    }, [isOpen]);

    const resetForm = () => {
        setAmount("");
        setClientName("");
        setMerchantName("");
        setResult(null);
        setBurst(false);
        setSiteName("");
        // 日付とカテゴリは連続入力時に便利なのでリセットしない
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = Number(amount);

        // バリデーション
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            showSnackbar("金額を入力してください", "error");
            return;
        }
        if (mode === "sales" && !clientName.trim()) {
            showSnackbar("取引先を入力してください", "error");
            return;
        }
        if (mode === "expenses" && !merchantName.trim()) {
            showSnackbar("支払先を入力してください", "error");
            return;
        }

        setLoading(true);
        try {
            let resPoints = 0;
            let resMessage = "";

            if (mode === "sales") {
                const res = await apiClient.post<SalesRegistrationResponse>("/api/v1/accounting/sales", {
                    amount: numericAmount,
                    clientName,
                    date,
                    siteName: siteName || undefined,
                    inputType: "manual",
                });
                resPoints = res.earnedPoints;
                resMessage = res.aiMessage;
            } else {
                try {
                    const res = await apiClient.post<{ earnedPoints: number; message: string }>("/api/v1/accounting/expenses", {
                        manualData: {
                            amount: numericAmount,
                            merchantName,
                            date,
                            category,
                            description: "マニュアル入力",
                            siteName: siteName || undefined,
                        },
                    });
                    resPoints = res.earnedPoints || 10;
                    resMessage = res.message || "経費を登録しました";
                } catch (err: any) {
                    // 重複エラーなどのハンドリング
                    if (err?.message?.includes?.("409") || err?.message?.includes?.("Duplicate")) {
                        showSnackbar("⚠️ すでに同じ経費が登録されています", "error");
                    } else {
                        showSnackbar("登録に失敗しました", "error");
                    }
                    setLoading(false);
                    return;
                }
            }

            onSuccess();

            // 連続モードならフォームをリセットして次へ、通常なら完了画面へ
            if (isContinuous && mode === "expenses") {
                showSnackbar(`登録しました！(+${resPoints}pt) 次をどうぞ 👉`, "success");
                resetForm();
                setLoading(false);
            } else {
                setResult({ points: resPoints, message: resMessage });
                setStep("success");
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            showSnackbar("通信エラーが発生しました", "error");
            setLoading(false);
        }
    };

    return {
        step, setStep,
        mode, setMode,
        amount, setAmount,
        clientName, setClientName,
        merchantName, setMerchantName,
        category, setCategory,
        date, setDate,
        siteName, setSiteName,
        loading,
        result,
        burst,
        isContinuous, setIsContinuous,
        clients,
        handleSubmit,
        resetForm,
    };
}
