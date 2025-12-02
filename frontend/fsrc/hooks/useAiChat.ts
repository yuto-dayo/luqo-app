import { useState, useRef, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import { useSnackbar } from "../contexts/SnackbarContext";
import { fetchLogHistory, type LogHistoryItem, postLog, createLogEventRequest, fetchLogSummary, type LogSummaryResponse } from "../lib/api";

type Message = {
    role: "user" | "assistant";
    text: string;
};

export type ChatMode = "chat" | "quick-log";

// 本来はAPIから取得するユーザーリスト（Mock）
const MOCK_USERS = [
    { id: "yamada", name: "山田 (Leader)" },
    { id: "sato", name: "佐藤 (Giver)" },
    { id: "suzuki", name: "鈴木 (Maverick)" },
    { id: "tanaka", name: "田中 (New)" },
];

export function useAiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<ChatMode>("chat");
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            text: "お疲れ様です！\n今日の作業報告や、アプリの使い方について何でも聞いてください🤖\n（例：パテのTスコア基準は？）",
        },
    ]);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLogHistoryOpen, setIsLogHistoryOpen] = useState(false);
    const [logHistory, setLogHistory] = useState<LogHistoryItem[]>([]);
    const [logHistoryLoading, setLogHistoryLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    
    // チーム要約関連の状態
    const [logSummaryTab, setLogSummaryTab] = useState<"personal" | "team">("personal");
    const [summaryStartDate, setSummaryStartDate] = useState<string>("");
    const [summaryEndDate, setSummaryEndDate] = useState<string>("");
    const [logSummary, setLogSummary] = useState<LogSummaryResponse["summary"] | null>(null);
    const [logSummaryLoading, setLogSummaryLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart || 0;
        setInput(val);

        const textBeforeCursor = val.slice(0, cursor);
        const match = textBeforeCursor.match(/@(\w*)$/);

        if (match) {
            setMentionQuery(match[1].toLowerCase());
        } else {
            setMentionQuery(null);
        }
    };

    const insertMention = (userId: string) => {
        if (!inputRef.current) return;
        const el = inputRef.current;
        const cursorStart = el.selectionStart ?? input.length;
        const cursorEnd = el.selectionEnd ?? cursorStart;
        const before = input.slice(0, cursorStart);
        const after = input.slice(cursorEnd);
        const replacedBefore = before.replace(/@(\w*)$/, `@${userId} `);
        const nextValue = `${replacedBefore}${after}`;
        setInput(nextValue);
        setMentionQuery(null);

        requestAnimationFrame(() => {
            const pos = replacedBefore.length;
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    };

    const handleSend = async (e?: React.FormEvent, systemMessage?: string) => {
        e?.preventDefault();
        const userText = systemMessage || input;

        if (!userText.trim() || loading) return;

        // クイックログモードの場合は即座にログを保存
        if (mode === "quick-log") {
            setLoading(true);
            try {
                const event = createLogEventRequest({ text: userText });
                await postLog(event);
                showSnackbar("ログを保存しました！", "success");
                setInput("");
                setIsSuccess(true);
                setTimeout(() => setIsSuccess(false), 1000);
            } catch (err: any) {
                console.error(err);
                showSnackbar(err?.message ?? "保存に失敗しました", "error");
            } finally {
                setLoading(false);
            }
            return;
        }

        // チャットモード（既存のロジック）
        if (!systemMessage) {
            setInput("");
            setMentionQuery(null);
            setMessages((prev) => [...prev, { role: "user", text: userText }]);
        }

        setLoading(true);

        try {
            const res = await apiClient.post<{ ok: boolean; reply: string }>("/api/v1/agent/chat", {
                message: userText,
            });

            if (res.ok) {
                setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);

                if (res.reply.includes("記録しました") || res.reply.includes("保管します")) {
                    showSnackbar("ログを保存しました！", "success");
                    setIsSuccess(true);
                    setTimeout(() => setIsSuccess(false), 1000);
                }
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", text: "すみません、エラーが発生しました🙇‍♂️" },
                ]);
            }
        } catch (err) {
            console.error(err);
            setMessages((prev) => [...prev, { role: "assistant", text: "通信エラーです。" }]);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchLogs = () => {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setSelectedMonth(currentMonth);
        setIsLogHistoryOpen(true);
        loadLogHistory(currentMonth);
    };

    const loadLogHistory = async (month: string) => {
        setLogHistoryLoading(true);
        try {
            const res = await fetchLogHistory(month);
            if (res.ok) {
                setLogHistory(res.logs);
            } else {
                showSnackbar("過去ログの取得に失敗しました", "error");
            }
        } catch (err) {
            console.error(err);
            showSnackbar("過去ログの取得に失敗しました", "error");
        } finally {
            setLogHistoryLoading(false);
        }
    };

    const handleMonthChange = (month: string) => {
        setSelectedMonth(month);
        loadLogHistory(month);
    };

    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // 期間の初期化（過去1週間をデフォルト）
    useEffect(() => {
        if (isLogHistoryOpen && logSummaryTab === "team" && !summaryStartDate) {
            const end = new Date();
            const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            setSummaryEndDate(formatDate(end));
            setSummaryStartDate(formatDate(start));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLogHistoryOpen, logSummaryTab]);

    const loadLogSummary = async (startDate: string, endDate: string) => {
        if (!startDate || !endDate) {
            showSnackbar("開始日と終了日を指定してください", "error");
            return;
        }

        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T23:59:59Z`);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            showSnackbar("無効な日付形式です", "error");
            return;
        }

        if (start >= end) {
            showSnackbar("開始日は終了日より前である必要があります", "error");
            return;
        }

        setLogSummaryLoading(true);
        try {
            const res = await fetchLogSummary(
                start.toISOString(),
                end.toISOString()
            );
            if (res.ok) {
                setLogSummary(res.summary);
            } else {
                showSnackbar("要約の取得に失敗しました", "error");
            }
        } catch (err) {
            console.error(err);
            showSnackbar("要約の取得に失敗しました", "error");
        } finally {
            setLogSummaryLoading(false);
        }
    };

    const handleQuickSelectDays = (days: number) => {
        const end = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        setSummaryEndDate(formatDate(end));
        setSummaryStartDate(formatDate(start));
    };

    // AIの返答をログとして保存して会話を終了（会話全体を要約）
    const handleSaveAndEnd = async (assistantMessage: string) => {
        if (!assistantMessage.trim() || loading) return;

        setLoading(true);
        try {
            // 会話履歴全体を要約してログに保存するリクエストを送信
            // 初期メッセージを除いた会話履歴を送信
            const conversationHistory = messages
                .filter((m, i) => i > 0) // 初期メッセージを除外
                .map((m) => ({
                    role: m.role,
                    text: m.text,
                }));

            // 会話を要約してログに保存するリクエスト
            const summaryMessage = "この会話の内容を要約して、ログとして保存してください。会話で得られた重要な情報（事実・感情・工夫など）を含めてください。";
            
            const res = await apiClient.post<{ ok: boolean; reply: string }>("/api/v1/agent/chat", {
                message: summaryMessage,
                history: conversationHistory,
            });

            if (res.ok) {
                // AIがsave_logツールを呼び出した場合、res.replyに「記録しました」などのメッセージが含まれる
                const isSaved = res.reply.includes("記録しました") || 
                               res.reply.includes("ログを記録") || 
                               res.reply.includes("保管します");
                
                if (isSaved) {
                    // 会話履歴をリセット（初期メッセージのみ残す）
                    setMessages([
                        {
                            role: "assistant",
                            text: "お疲れ様です！\n今日の作業報告や、アプリの使い方について何でも聞いてください🤖\n（例：パテのTスコア基準は？）",
                        },
                    ]);
                    
                    showSnackbar("会話を要約してログに追加しました。会話をリセットしました。", "success");
                    setIsSuccess(true);
                    setTimeout(() => setIsSuccess(false), 2000);
                } else {
                    // AIが要約を保存しなかった場合（エラーなど）、フォールバックとして最後のAI返答を保存
                    console.warn("AIが要約を保存しませんでした。フォールバックとして最後の返答を保存します。");
                    const event = createLogEventRequest({ text: assistantMessage });
                    await postLog(event);
                    
                    setMessages([
                        {
                            role: "assistant",
                            text: "お疲れ様です！\n今日の作業報告や、アプリの使い方について何でも聞いてください🤖\n（例：パテのTスコア基準は？）",
                        },
                    ]);
                    
                    showSnackbar("ログに追加しました。会話をリセットしました。", "success");
                    setIsSuccess(true);
                    setTimeout(() => setIsSuccess(false), 2000);
                }
            } else {
                throw new Error("要約リクエストに失敗しました");
            }
        } catch (err: any) {
            console.error(err);
            showSnackbar(err?.message ?? "ログの保存に失敗しました", "error");
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers =
        mentionQuery !== null
            ? MOCK_USERS.filter(
                (u) =>
                    u.id.toLowerCase().includes(mentionQuery) || u.name.toLowerCase().includes(mentionQuery)
            )
            : [];

    // モード変更時にメッセージをリセット
    useEffect(() => {
        if (mode === "chat") {
            setMessages([
                {
                    role: "assistant",
                    text: "お疲れ様です！\n今日の作業報告や、アプリの使い方について何でも聞いてください🤖\n（例：パテのTスコア基準は？）",
                },
            ]);
        } else {
            setMessages([
                {
                    role: "assistant",
                    text: "クイックログモード\n作業内容を入力すると、すぐにログとして保存されます。",
                },
            ]);
        }
    }, [mode]);

    return {
        isOpen,
        setIsOpen,
        mode,
        setMode,
        input,
        loading,
        messages,
        isSuccess,
        scrollRef,
        inputRef,
        mentionQuery,
        filteredUsers,
        handleInputChange,
        insertMention,
        handleSend,
        handleFetchLogs,
        // 過去ログ関連
        isLogHistoryOpen,
        setIsLogHistoryOpen,
        logHistory,
        logHistoryLoading,
        selectedMonth,
        handleMonthChange,
        // チーム要約関連
        logSummaryTab,
        setLogSummaryTab,
        summaryStartDate,
        setSummaryStartDate,
        summaryEndDate,
        setSummaryEndDate,
        logSummary,
        logSummaryLoading,
        loadLogSummary,
        handleQuickSelectDays,
        // ログ保存して終了
        handleSaveAndEnd,
    };
}
