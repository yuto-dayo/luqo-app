import { useEffect } from "react";
import type { Score } from "./useLuqoStore";

// 背景色に対して読みやすい文字色を返す
function getContrastColor(hexColor: string) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? "#1f1f1f" : "#ffffff";
}

export function useDynamicTheme(score: Score) {
    useEffect(() => {
        if (!score.ui?.theme) return;

        const { color, radiusLevel, vibe } = score.ui.theme;
        const root = document.documentElement;

        // 1. 色の適用 (メインカラー)
        root.style.setProperty("--color-seed", color);
        root.style.setProperty("--color-on-seed", getContrastColor(color));

        // Surface Tones (簡易的なトーン生成)
        // Container Low: 背景用 (薄いグレー/色付き)
        root.style.setProperty("--color-surface-container-low", `color-mix(in srgb, ${color}, #f8fafc 96%)`);
        // Container Lowest: カード用 (ほぼ白)
        root.style.setProperty("--color-surface-container-lowest", "#ffffff");

        // 薄い背景用 (既存)
        root.style.setProperty("--color-seed-bg", `${color}15`);

        // 2. 形状 (角丸) の適用
        // radiusLevel (0-100) を px に変換
        // M3EのMediumは12px, Largeは16px, ExtraLargeは28pxくらい
        const radiusPx = Math.max(4, Math.min(32, radiusLevel * 0.32));
        root.style.setProperty("--radius-dynamic", `${radiusPx}px`);

        // 3. 動き (Animation Duration) の適用
        let duration = "0.4s";
        let easing = "ease-out";

        if (vibe === "energetic") {
            duration = "0.3s";
            easing = "cubic-bezier(0.175, 0.885, 0.32, 1.275)"; // 弾む動き
        } else if (vibe === "calm") {
            duration = "0.8s";
            easing = "ease-in-out"; // ゆったり
        }

        root.style.setProperty("--motion-duration", duration);
        root.style.setProperty("--motion-easing", easing);

    }, [
        score.ui?.theme?.color,
        score.ui?.theme?.radiusLevel,
        score.ui?.theme?.vibe,
    ]);
}
