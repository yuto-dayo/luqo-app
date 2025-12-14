import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ConfirmDialogContextType = {
    confirm: (message: string) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined);

export const useConfirm = () => {
    const context = useContext(ConfirmDialogContext);
    if (!context) {
        throw new Error("useConfirm must be used within a ConfirmDialogProvider");
    }
    return context;
};

export const ConfirmDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((msg: string) => {
        setMessage(msg);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolveRef(() => resolve);
        });
    }, []);

    const handleClose = (result: boolean) => {
        setIsOpen(false);
        if (resolveRef) {
            resolveRef(result);
            setResolveRef(null);
        }
    };

    return (
        <ConfirmDialogContext.Provider value={{ confirm }}>
            {children}

            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        backdropFilter: "blur(2px)",
                        zIndex: 10001,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "fadeIn 0.2s ease-out",
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "28px",
                            padding: "24px",
                            width: "100%",
                            maxWidth: "320px",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                            animation: "scaleIn 0.2s cubic-bezier(0.2, 0, 0, 1)",
                        }}
                    >
                        <h3 style={{ margin: "0 0 16px", fontSize: "18px", color: "#1f1f1f" }}>確認</h3>
                        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#444746", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                            {message}
                        </p>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                                onClick={() => handleClose(false)}
                                style={{
                                    padding: "10px 24px",
                                    borderRadius: "100px",
                                    border: "none",
                                    background: "transparent",
                                    color: "#00639b",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={() => handleClose(true)}
                                style={{
                                    padding: "10px 24px",
                                    borderRadius: "100px",
                                    border: "none",
                                    background: "#00639b",
                                    color: "#ffffff",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
        </ConfirmDialogContext.Provider>
    );
};
