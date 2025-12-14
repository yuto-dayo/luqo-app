import React, { useMemo, useState } from "react";
import { Icon } from "./ui/Icon";
import styles from "./MissionControlCard.module.css";
import { type BanditSuggestResponse, updateMission } from "../lib/api";
import { type Score } from "../hooks/useLuqoStore";
import { useRetroGameMode } from "../hooks/useRetroGameMode";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useConfirm } from "../contexts/ConfirmDialogContext";
import { Confetti } from "./Confetti"; // Correctly using named import
import { RetroHPBar } from "./ui/RetroHPBar";

// --- Logic Helpers from TimeSyncBanner ---
const DAY_MS = 24 * 60 * 60 * 1000;
const PHASE_DAYS = 14;

function ceilDaysLeft(targetMs: number, nowMs: number) {
    return Math.max(0, Math.ceil((targetMs - nowMs) / DAY_MS));
}

// --- Props Definition ---
type Props = {
    banditData: BanditSuggestResponse | null;
    score: Score;
    loading: boolean;
    scoreReady: boolean;
    onMissionUpdated?: () => void;
};

// --- Sub-component: Progress Ring (Gauge) ---
const ProgressRing = ({ value, color, iconName, label, isActive }: any) => {
    const size = isActive ? 80 : 64;
    const strokeWidth = isActive ? 8 : 6;
    const radius = (size - strokeWidth) / 2;
    const c = radius * 2 * Math.PI;
    const offset = c - (value / 100) * c;

    return (
        <div className={styles.gaugeContainer} style={{ opacity: isActive ? 1 : 0.7, transform: isActive ? "scale(1.05)" : "scale(1)" }}>
            {isActive && (
                <div className={styles.boostingBadge} style={{ background: color }}>
                    <Icon name="fire" size={10} color="white" /> BOOST
                </div>
            )}
            <div style={{ position: "relative", width: size, height: size }}>
                <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={color} strokeWidth={strokeWidth} strokeOpacity={0.15} />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={c}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.2, 0, 0, 1)" }}
                    />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: color }}>
                    <Icon name={iconName} size={isActive ? 20 : 16} />
                    <span style={{ fontSize: isActive ? 16 : 13, fontWeight: 800, marginTop: 2, lineHeight: 1 }}>{Math.round(value)}</span>
                </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? color : "#94a3b8" }}>{label}</span>
        </div>
    );
};

export const MissionControlCard: React.FC<Props> = ({ banditData, score, loading, scoreReady, onMissionUpdated }) => {
    const isRetroGameMode = useRetroGameMode();
    const { showSnackbar } = useSnackbar();
    const { confirm } = useConfirm();

    // --- State for Edit Modal ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editAction, setEditAction] = useState("");
    const [editHint, setEditHint] = useState("");
    const [editChangeReason, setEditChangeReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);


    // --- 1. Context Logic (Time/Phase) ---
    const timeContext = useMemo(() => {
        if (!banditData?.context?.okr) return null;
        const { startAt, endAt } = banditData.context.okr;
        if (!startAt || !endAt) return null;

        const startMs = new Date(startAt).getTime();
        const endMs = new Date(endAt).getTime();
        const nowMs = Date.now();

        if (startMs >= endMs) return null;

        const phaseMs = PHASE_DAYS * DAY_MS;
        const phaseCount = Math.max(1, Math.ceil((endMs - startMs) / phaseMs));
        const unclampedPhaseIndex = Math.floor((nowMs - startMs) / phaseMs);
        const phaseIndex = Math.min(Math.max(unclampedPhaseIndex, 0), phaseCount - 1);

        const phaseStartMs = startMs + phaseIndex * phaseMs;
        const phaseEndMs = Math.min(startMs + (phaseIndex + 1) * phaseMs, endMs);
        const phaseDaysLeft = ceilDaysLeft(phaseEndMs, nowMs);
        const phaseProgress = Math.min(1, Math.max(0, (nowMs - phaseStartMs) / Math.max(1, phaseEndMs - phaseStartMs)));

        return {
            label: `フェーズ ${phaseIndex + 1}/${phaseCount}`,
            daysLeft: phaseDaysLeft,
            progress: phaseProgress
        };
    }, [banditData]);

    // --- Handlers ---
    const handleOpenEditModal = () => {
        if (!banditData) return;
        setEditAction(banditData.suggestion.action);
        setEditHint(banditData.suggestion.luqoHint);
        setEditChangeReason("");
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
    };

    const handleSubmitEdit = async () => {
        if (await confirm("ミッションを更新しますか？\nこの操作は取り消せません。")) {
            setIsSubmitting(true);
            try {
                await updateMission({
                    action: editAction.trim(),
                    hint: editHint.trim(),
                    changeReason: editChangeReason.trim(),
                });
                showSnackbar("ミッションを更新しました", "success");
                handleCloseEditModal();
                onMissionUpdated?.();
            } catch (error: any) {
                showSnackbar(error?.message || "更新失敗", "error");
            } finally {
                setIsSubmitting(false);
            }
        }
    };



    // --- Rendering ---

    // Loading State
    if (loading || !banditData) {
        return <div className={styles.card} style={{ height: 300, alignItems: "center", justifyContent: "center" }}><Icon name="ai" size={32} className={styles.spinner} /></div>;
    }

    const focusDim = banditData.focusDimension || "Q";
    const action = banditData.suggestion.action;
    const hint = banditData.suggestion.luqoHint;

    // Theme Colors based on Dimension
    const THEME = {
        LU: { primary: "var(--color-lu-base, #0ea5e9)", bg: "var(--color-lu-bg, #e0f2fe)", onBg: "#0c4a6e" },
        Q: { primary: "var(--color-q-base, #22c55e)", bg: "var(--color-q-bg, #dcfce7)", onBg: "#14532d" },
        O: { primary: "var(--color-o-base, #f97316)", bg: "var(--color-o-bg, #ffedd5)", onBg: "#7c2d12" },
    }[focusDim] || { primary: "#64748b", bg: "#f1f5f9", onBg: "#1e293b" };

    return (
        <div className={styles.card}>
            {/* 1. KEY CONTEXT */}
            {timeContext && (
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <div className={styles.phaseLabel}>
                            <Icon name="flag" size={14} />
                            {timeContext.label}
                        </div>
                        <div className={styles.seasonLabel}>残り {timeContext.daysLeft} 日</div>
                    </div>
                    <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${timeContext.progress * 100}%` }} />
                    </div>
                </div>
            )}

            {/* 2. CORE ACTION */}
            <div className={styles.actionSection} style={{ "--mission-bg": THEME.bg, "--mission-on-bg": THEME.onBg } as React.CSSProperties}>


                <div className={styles.actionHeader}>
                    <h2 className={styles.actionTitle}>{action}</h2>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div className={styles.actionHint}>
                        <Icon name="info" size={16} />
                        {hint}
                    </div>

                    <button
                        className={styles.iconButton}
                        style={{ "--mission-primary": THEME.primary } as React.CSSProperties}
                        onClick={handleOpenEditModal}
                        title="ミッションを変更"
                    >
                        <Icon name="edit" size={24} />
                    </button>
                </div>
            </div>

            {/* 3. FEEDBACK (Scores) */}
            <div className={styles.footer}>
                <div className={styles.footerHeader}>LUQO Score</div>
                {isRetroGameMode ? (
                    <div className={styles.scoreGrid} style={{ flexDirection: 'column', gap: 24, padding: "0 12px" }}>
                        <RetroHPBar value={score.LU} color="#00ffff" iconName="learning" label="学習" isActive={focusDim === "LU"} />
                        <RetroHPBar value={score.Q} color="#00ff00" iconName="contribution" label="貢献" isActive={focusDim === "Q"} />
                        <RetroHPBar value={score.O} color="#ff00ff" iconName="innovation" label="革新" isActive={focusDim === "O"} />
                    </div>
                ) : (
                    <div className={styles.scoreGrid}>
                        <ProgressRing value={score.LU} color="var(--color-lu-base, #0ea5e9)" iconName="learning" label="学習" isActive={focusDim === "LU"} />
                        <ProgressRing value={score.Q} color="var(--color-q-base, #22c55e)" iconName="contribution" label="貢献" isActive={focusDim === "Q"} />
                        <ProgressRing value={score.O} color="var(--color-o-base, #f97316)" iconName="innovation" label="革新" isActive={focusDim === "O"} />
                    </div>
                )}
            </div>

            {/* Edit Modal (Copied logic simplfied for brevity, assuming standard modal) */}
            {isEditModalOpen && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={handleCloseEditModal}>
                    <div style={{ background: "white", padding: 24, borderRadius: 16, width: "90%", maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <h3>ミッションを編集</h3>
                        {/* Simple inputs for demo */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                            <input value={editAction} onChange={e => setEditAction(e.target.value)} className="home-log-input__field" />
                            <textarea value={editHint} onChange={e => setEditHint(e.target.value)} className="home-log-input__field" />
                            <textarea value={editChangeReason} onChange={e => setEditChangeReason(e.target.value)} placeholder="変更理由" className="home-log-input__field" />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                                <button onClick={handleCloseEditModal} className="btn">キャンセル</button>
                                <button onClick={handleSubmitEdit} className="btn btn--primary" disabled={isSubmitting}>保存</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
