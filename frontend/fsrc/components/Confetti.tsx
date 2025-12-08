import React, { useEffect, useRef } from "react";
import styles from "./Confetti.module.css";

type Props = {
  /** 紙吹雪を表示するかどうか */
  active: boolean;
  /** 紙吹雪の色（デフォルトはカラフル） */
  colors?: string[];
  /** 紙吹雪の数（デフォルトは50） */
  particleCount?: number;
  /** アニメーションの持続時間（ミリ秒、デフォルトは3000） */
  duration?: number;
};

/**
 * 紙吹雪（Confetti）コンポーネント
 * 承認や成功時に表示する演出用
 */
export const Confetti: React.FC<Props> = ({
  active,
  colors = ["#0284c7", "#16a34a", "#d97706", "#a855f7", "#ec4899"],
  particleCount = 50,
  duration = 3000,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const particles: HTMLDivElement[] = [];

    // 紙吹雪のパーティクルを生成
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = styles.particle;

      // ランダムな色を選択
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.backgroundColor = color;

      // ランダムな位置と角度
      const startX = Math.random() * 100;
      const startY = -10;
      const angle = Math.random() * 360;
      const velocity = 50 + Math.random() * 50;
      const rotation = Math.random() * 720 - 360;

      particle.style.left = `${startX}%`;
      particle.style.top = `${startY}%`;
      particle.style.setProperty("--start-x", `${startX}%`);
      particle.style.setProperty("--start-y", `${startY}%`);
      particle.style.setProperty("--end-x", `${startX + (Math.random() - 0.5) * 100}%`);
      particle.style.setProperty("--end-y", `${100 + Math.random() * 20}%`);
      particle.style.setProperty("--rotation", `${rotation}deg`);
      particle.style.setProperty("--duration", `${duration}ms`);

      container.appendChild(particle);
      particles.push(particle);
    }

    // アニメーション終了後にパーティクルを削除
    const timeout = setTimeout(() => {
      particles.forEach((particle) => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
    }, duration);

    return () => {
      clearTimeout(timeout);
      particles.forEach((particle) => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
    };
  }, [active, colors, particleCount, duration]);

  if (!active) return null;

  return <div ref={containerRef} className={styles.container} />;
};
