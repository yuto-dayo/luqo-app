import React, { useEffect, useRef } from "react";

type Props = {
  isActive: boolean;
};

/**
 * ランダムな要素にグリッチエフェクトを適用するコンポーネント
 * 画面上のボタンやカードなどが、数秒に一回「ビリッ」とノイズが走るような演出を追加
 */
const GlitchEffect: React.FC<Props> = ({ isActive }) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // すべてのグリッチクラスを削除
      document.querySelectorAll(".retro-glitch-temp").forEach((el) => {
        el.classList.remove("retro-glitch-temp");
      });
      return;
    }

    const applyGlitch = () => {
      // グリッチを適用できる要素を選択（ボタン、カード、リンクなど）
      const selectors = [
        "button",
        ".card",
        "a",
        "input",
        ".app-shell__link",
        ".kpi-header__pill",
      ];

      const allElements: Element[] = [];
      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          // 既にグリッチが適用されている要素は除外
          if (!el.classList.contains("retro-glitch-temp")) {
            allElements.push(el);
          }
        });
      });

      if (allElements.length === 0) return;

      // ランダムに1〜3個の要素を選択
      const count = Math.floor(Math.random() * 3) + 1;
      const selectedElements: Element[] = [];

      for (let i = 0; i < count && allElements.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * allElements.length);
        selectedElements.push(allElements[randomIndex]);
        allElements.splice(randomIndex, 1);
      }

      // 選択した要素にグリッチエフェクトを適用
      selectedElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.classList.add("retro-glitch-temp");

        // ランダムなグリッチアニメーション
        const glitchType = Math.random();
        if (glitchType < 0.33) {
          // タイプ1: 水平方向のズレ
          htmlEl.style.transform = `translateX(${(Math.random() - 0.5) * 10}px)`;
          htmlEl.style.clipPath = `inset(0 ${Math.random() * 5}% 0 ${Math.random() * 5}%)`;
        } else if (glitchType < 0.66) {
          // タイプ2: 垂直方向のズレ
          htmlEl.style.transform = `translateY(${(Math.random() - 0.5) * 10}px)`;
          htmlEl.style.clipPath = `inset(${Math.random() * 5}% 0 ${Math.random() * 5}% 0)`;
        } else {
          // タイプ3: 斜めのズレ
          htmlEl.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
          htmlEl.style.clipPath = `inset(${Math.random() * 3}% ${Math.random() * 3}% ${Math.random() * 3}% ${Math.random() * 3}%)`;
        }

        // RGB Shiftエフェクト
        htmlEl.style.filter = `drop-shadow(2px 0 0 #ff0000) drop-shadow(-2px 0 0 #00ffff)`;

        // 100ms後に元に戻す
        setTimeout(() => {
          htmlEl.style.transform = "";
          htmlEl.style.clipPath = "";
          htmlEl.style.filter = "";
          htmlEl.classList.remove("retro-glitch-temp");
        }, 100);
      });
    };

    // 3〜8秒ごとにランダムにグリッチを適用
    const scheduleNext = () => {
      const delay = Math.random() * 5000 + 3000; // 3〜8秒
      intervalRef.current = setTimeout(() => {
        applyGlitch();
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      // クリーンアップ
      document.querySelectorAll(".retro-glitch-temp").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.transform = "";
        htmlEl.style.clipPath = "";
        htmlEl.style.filter = "";
        htmlEl.classList.remove("retro-glitch-temp");
      });
    };
  }, [isActive]);

  return null; // このコンポーネントはDOMを描画しない
};

export default GlitchEffect;


