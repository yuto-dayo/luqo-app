import React, { useState } from "react";
import { createLogEventRequest, postLog } from "../lib/api";
import { useSnackbar } from "../contexts/SnackbarContext";
import { Icon } from "./ui/Icon";

export const LogEntry: React.FC = () => {
    const [text, setText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showSnackbar } = useSnackbar();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;

        setIsSubmitting(true);

        try {
            const event = createLogEventRequest({ text });
            await postLog(event);

            showSnackbar("ログを保存しました！", "success");
            setText("");
        } catch (err: any) {
            console.error(err);
            showSnackbar(err?.message ?? "保存に失敗しました", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <header className="card__header">
                <h2 className="card__title">Daily Log</h2>
                <span className="card__status">今日の記録</span>
            </header>

            <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: 12 }}>
                <textarea
                    className="log-textarea"
                    placeholder="今日はどんな作業をしましたか？&#13;&#10;・やったこと&#13;&#10;・気づき&#13;&#10;・次やること"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isSubmitting}
                    style={{
                        width: "100%",
                        flex: 1,
                        minHeight: "200px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        resize: "none",
                        marginBottom: "12px",
                        outline: "none",
                        background: isSubmitting ? "#f9fafb" : "#fff",
                        transition: "background var(--motion-duration) var(--motion-easing)",
                    }}
                />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <button
                        type="submit"
                        disabled={isSubmitting || !text.trim()}
                        style={{
                            padding: "8px 24px",
                            borderRadius: "100px",
                            border: "none",
                            background: isSubmitting ? "#9ca3af" : "#2563eb",
                            color: "white",
                            fontWeight: 600,
                            cursor: isSubmitting ? "default" : "pointer",
                            transition: "all var(--motion-duration) var(--motion-easing)",
                            transform: isSubmitting ? "scale(0.95)" : "scale(1)",
                            boxShadow: isSubmitting ? "none" : "0 2px 4px rgba(0,0,0,0.1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="spinner" />
                                送信中...
                            </>
                        ) : (
                            <>
                                ログを記録
                                <Icon name="pen" size={16} />
                            </>
                        )}
                    </button>
                </div>
            </form>
            <style>{`
                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid #fff;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    display: inline-block;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </section>
    );
};
