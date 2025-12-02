import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";

type SnackbarType = "success" | "error" | "info";

type SnackbarAction = {
    label: string;
    onClick: () => void;
};

type SnackbarContextType = {
    showSnackbar: (message: string, type?: SnackbarType, action?: SnackbarAction) => void;
};

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const useSnackbar = () => {
    const context = useContext(SnackbarContext);
    if (!context) {
        throw new Error("useSnackbar must be used within a SnackbarProvider");
    }
    return context;
};

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [type, setType] = useState<SnackbarType>("info");
    const [action, setAction] = useState<SnackbarAction | undefined>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showSnackbar = useCallback((msg: string, t: SnackbarType = "info", act?: SnackbarAction) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setMessage(msg);
        setType(t);
        setAction(act);
        setIsOpen(true);

        // Auto hide after 4 seconds
        timerRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 4000);
    }, []);

    return (
        <SnackbarContext.Provider value={{ showSnackbar }}>
            {children}
            {/* Snackbar Component */}
            <div
                style={{
                    position: "fixed",
                    bottom: "24px",
                    left: "50%",
                    transform: `translateX(-50%) translateY(${isOpen ? "0" : "100px"})`,
                    opacity: isOpen ? 1 : 0,
                    transition: "transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease",
                    backgroundColor: type === "error" ? "#b3261e" : "#323232",
                    color: "#f2f2f2",
                    padding: "14px 24px",
                    borderRadius: "8px",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                    zIndex: 10000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "24px",
                    minWidth: "320px",
                    maxWidth: "90vw",
                }}
            >
                <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
                {action && (
                    <button
                        onClick={() => {
                            action.onClick();
                            setIsOpen(false);
                        }}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#a8c7fa",
                            fontWeight: "bold",
                            fontSize: "14px",
                            cursor: "pointer",
                            padding: "4px 8px",
                            marginLeft: "auto",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {action.label}
                    </button>
                )}
            </div>
        </SnackbarContext.Provider>
    );
};
