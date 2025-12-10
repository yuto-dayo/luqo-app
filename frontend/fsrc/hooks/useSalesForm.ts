import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { SalesRegistrationResponse, WorkCategory } from "../types/accounting";

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
    const [items, setItems] = useState<Array<{ name: string; quantity?: number; unitPrice?: number }>>([]); // 品名リスト

    // 工事カテゴリの状態（複数選択対応）
    type SelectedCategory = {
        id: string;
        label: string;
        amount: string; // カテゴリごとの金額（文字列として管理）
    };
    const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([]); // 選択されたカテゴリと各カテゴリの金額
    const [workCategories, setWorkCategories] = useState<WorkCategory[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState(""); // 新規カテゴリ入力用
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [addingCategory, setAddingCategory] = useState(false);
    
    // 後方互換性のため、既存の単一選択の状態も維持（非推奨）
    const [workCategoryId, setWorkCategoryId] = useState<string>("");
    const [workCategoryLabel, setWorkCategoryLabel] = useState<string>("");

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

    // 工事カテゴリマスタの取得
    const loadWorkCategories = useCallback(async () => {
        setLoadingCategories(true);
        try {
            const res = await apiClient.get<{ ok: boolean; categories: WorkCategory[] }>("/api/v1/master/categories");
            if (res.ok && res.categories) {
                setWorkCategories(res.categories);
            }
        } catch (err) {
            console.error("Failed to load work categories", err);
        } finally {
            setLoadingCategories(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        loadWorkCategories();
    }, [isOpen, loadWorkCategories]);

    // 工事カテゴリの複数選択ハンドラ
    const toggleCategorySelection = (categoryId: string) => {
        const category = workCategories.find(c => c.id === categoryId);
        if (!category) return;

        const isSelected = selectedCategories.some(sc => sc.id === categoryId);
        if (isSelected) {
            // カテゴリを削除
            setSelectedCategories(prev => prev.filter(sc => sc.id !== categoryId));
        } else {
            // カテゴリを追加（金額は空文字列で初期化）
            setSelectedCategories(prev => [...prev, { id: categoryId, label: category.label, amount: "" }]);
        }
    };

    // カテゴリの金額を更新
    const updateCategoryAmount = (categoryId: string, amount: string) => {
        setSelectedCategories(prev =>
            prev.map(sc => sc.id === categoryId ? { ...sc, amount } : sc)
        );
    };

    // カテゴリを削除
    const removeCategory = (categoryId: string) => {
        setSelectedCategories(prev => prev.filter(sc => sc.id !== categoryId));
    };

    // 後方互換性のため、既存の単一選択ハンドラも維持（非推奨）
    const handleWorkCategoryChange = (value: string) => {
        if (value === "__new__") {
            // 新規カテゴリ追加モードに切り替え
            setShowNewCategoryInput(true);
            setWorkCategoryId("");
            setWorkCategoryLabel("");
        } else {
            setShowNewCategoryInput(false);
            setNewCategoryInput("");
            setWorkCategoryId(value);
            // ラベルを取得
            const selectedCat = workCategories.find(c => c.id === value);
            setWorkCategoryLabel(selectedCat?.label || "");
        }
    };

    // 新規カテゴリの追加
    const handleAddNewCategory = async () => {
        if (!newCategoryInput.trim()) return;
        setAddingCategory(true);
        try {
            const res = await apiClient.post<{ ok: boolean; category: WorkCategory; error?: string }>(
                "/api/v1/master/categories",
                { label: newCategoryInput.trim(), defaultWeight: 1.0 }
            );
            if (res.ok && res.category) {
                // カテゴリリストに追加
                setWorkCategories(prev => [...prev, res.category]);
                // 新しく追加したカテゴリを自動的に選択状態にする
                setSelectedCategories(prev => {
                    // 既に選択されている場合は追加しない
                    if (prev.some(sc => sc.id === res.category.id)) return prev;
                    return [...prev, { id: res.category.id, label: res.category.label, amount: "" }];
                });
                // 入力フィールドを閉じる
                setShowNewCategoryInput(false);
                setNewCategoryInput("");
                showSnackbar(`「${res.category.label}」を追加しました`, "success");
            } else {
                showSnackbar(res.error || "カテゴリの追加に失敗しました", "error");
            }
        } catch (err: any) {
            console.error("Failed to add category", err);
            showSnackbar(err?.message || "カテゴリの追加に失敗しました", "error");
        } finally {
            setAddingCategory(false);
        }
    };

    // AIからの推奨カテゴリを設定（単一カテゴリ、後方互換性）
    const setSuggestedCategory = useCallback((suggestedCode: string | null) => {
        if (!suggestedCode) return;
        // コードまたはラベルからカテゴリを検索
        const matchedCat = workCategories.find(
            c => c.code === suggestedCode || c.label.includes(suggestedCode) || suggestedCode.includes(c.label)
        );
        if (matchedCat) {
            // 複数選択リストに追加（既に選択されている場合は追加しない）
            setSelectedCategories(prev => {
                if (prev.some(sc => sc.id === matchedCat.id)) return prev;
                return [...prev, { id: matchedCat.id, label: matchedCat.label, amount: "" }];
            });
            // 後方互換性のため単一選択の状態も更新
            setWorkCategoryId(matchedCat.id);
            setWorkCategoryLabel(matchedCat.label);
        }
    }, [workCategories]);

    // AIからの推奨カテゴリを設定（複数カテゴリと金額のペア対応）
    const setSuggestedCategories = useCallback((categories: Array<{ categoryCode: string; amount: number }>) => {
        if (!categories || categories.length === 0) return;
        
        // 一度のstate更新ですべてのカテゴリを追加/更新する
        setSelectedCategories(prev => {
            const updated = [...prev];
            
            categories.forEach(({ categoryCode, amount }) => {
                if (!categoryCode) return;
                
                // コードまたはラベルからカテゴリを検索
                const matchedCat = workCategories.find(
                    c => c.code === categoryCode || c.label.includes(categoryCode) || categoryCode.includes(c.label)
                );
                
                if (matchedCat) {
                    // 既に選択されている場合は金額を更新、なければ追加
                    const existingIndex = updated.findIndex(sc => sc.id === matchedCat.id);
                    if (existingIndex >= 0) {
                        // 既存のカテゴリの金額を更新
                        updated[existingIndex] = {
                            ...updated[existingIndex],
                            amount: String(amount),
                        };
                    } else {
                        // 新しいカテゴリを追加（金額も設定）
                        updated.push({
                            id: matchedCat.id,
                            label: matchedCat.label,
                            amount: String(amount),
                        });
                    }
                }
            });
            
            return updated;
        });
    }, [workCategories]);

    const resetForm = () => {
        setAmount("");
        setClientName("");
        setMerchantName("");
        setResult(null);
        setBurst(false);
        setSiteName("");
        setItems([]); // 品名リストもリセット
        setSelectedCategories([]); // 複数選択カテゴリをリセット
        setWorkCategoryId(""); // 工事カテゴリもリセット（後方互換性）
        setWorkCategoryLabel("");
        setShowNewCategoryInput(false);
        setNewCategoryInput("");
        // 日付とカテゴリは連続入力時に便利なのでリセットしない
    };
    
    // 品名を追加
    const addItem = () => {
        setItems([...items, { name: "" }]);
    };
    
    // 品名を更新
    const updateItem = (index: number, field: "name" | "quantity" | "unitPrice", value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };
    
    // 品名を削除
    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // バリデーション
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
                // 複数カテゴリが選択されている場合、各カテゴリごとに売上を登録
                if (selectedCategories.length > 0) {
                    // 選択されたカテゴリごとに金額が入力されているかチェック
                    const categoriesWithAmounts = selectedCategories.filter(sc => {
                        const catAmount = Number(sc.amount);
                        return Number.isFinite(catAmount) && catAmount > 0;
                    });

                    if (categoriesWithAmounts.length === 0) {
                        showSnackbar("選択したカテゴリごとに金額を入力してください", "error");
                        setLoading(false);
                        return;
                    }

                    // 各カテゴリごとに売上を登録
                    const registrationPromises = categoriesWithAmounts.map(async (category) => {
                        const categoryAmount = Number(category.amount);
                        const res = await apiClient.post<SalesRegistrationResponse>("/api/v1/accounting/sales", {
                            amount: categoryAmount,
                            clientName,
                            date,
                            siteName: siteName || undefined,
                            inputType: "manual",
                            workCategoryId: category.id,
                            workCategoryLabel: category.label,
                        });
                        return res;
                    });

                    const results = await Promise.all(registrationPromises);
                    // ポイントとメッセージを集計
                    resPoints = results.reduce((sum, r) => sum + r.earnedPoints, 0);
                    resMessage = `合計${categoriesWithAmounts.length}件の売上を登録しました`;
                } else {
                    // カテゴリが選択されていない場合は、従来通り単一の売上を登録
                    const numericAmount = Number(amount);
                    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                        showSnackbar("金額を入力してください", "error");
                        setLoading(false);
                        return;
                    }
                    const res = await apiClient.post<SalesRegistrationResponse>("/api/v1/accounting/sales", {
                        amount: numericAmount,
                        clientName,
                        date,
                        siteName: siteName || undefined,
                        inputType: "manual",
                        // 後方互換性のため、単一選択の状態も確認
                        workCategoryId: workCategoryId || undefined,
                        workCategoryLabel: workCategoryLabel || undefined,
                    });
                    resPoints = res.earnedPoints;
                    resMessage = res.aiMessage;
                }
            } else {
                // 経費登録の場合
                const numericAmount = Number(amount);
                if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                    showSnackbar("金額を入力してください", "error");
                    setLoading(false);
                    return;
                }
                try {
                    // 品名リストをフィルタリング（空の品名を除外）
                    const validItems = items.filter(item => item.name.trim().length > 0);
                    
                    const res = await apiClient.post<{ earnedPoints: number; message: string }>("/api/v1/accounting/expenses", {
                        manualData: {
                            amount: numericAmount,
                            merchantName,
                            date,
                            category,
                            description: "マニュアル入力",
                            siteName: siteName || undefined,
                            items: validItems.length > 0 ? validItems : undefined,
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
        items, setItems, addItem, updateItem, removeItem,
        loading,
        result,
        burst,
        isContinuous, setIsContinuous,
        clients,
        handleSubmit,
        resetForm,
        // 工事カテゴリ関連（複数選択対応）
        selectedCategories,
        toggleCategorySelection,
        updateCategoryAmount,
        removeCategory,
        workCategories,
        loadingCategories,
        newCategoryInput, setNewCategoryInput,
        showNewCategoryInput, setShowNewCategoryInput,
        handleAddNewCategory,
        addingCategory,
        setSuggestedCategory,
        setSuggestedCategories, // 複数カテゴリ対応
        // 後方互換性のため、既存の単一選択APIも維持（非推奨）
        workCategoryId, setWorkCategoryId,
        workCategoryLabel, setWorkCategoryLabel,
        handleWorkCategoryChange,
    };
}
