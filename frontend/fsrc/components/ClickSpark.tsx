import React, { useState, useEffect, useCallback } from "react";
import styles from "./ClickSpark.module.css";

type Spark = {
  id: number;
  x: number;
  y: number;
  label?: string;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  tx: string;
  ty: string;
  color: string;
};

type Props = {
  isActive: boolean;
};

const ClickSpark: React.FC<Props> = ({ isActive }) => {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  const addEffect = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    
    // HIT! 文字エフェクト
    setSparks((prev) => [...prev, { id, x, y, label: "HIT!" }]);
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => s.id !== id));
    }, 500);

    // パーティクルエフェクト (8個のドットが飛び散る)
    const newParticles: Particle[] = [];
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#2d2d2d"];
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const tx = `${Math.cos(angle) * distance}px`;
      const ty = `${Math.sin(angle) * distance}px`;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      newParticles.push({
        id: id + i + 1,
        x,
        y,
        tx,
        ty,
        color,
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id < id + 10));
    }, 600);

  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      let x, y;
      if (e instanceof MouseEvent) {
        x = e.clientX;
        y = e.clientY;
      } else {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      }
      addEffect(x, y);
    };

    window.addEventListener("mousedown", handleClick);

    return () => {
      window.removeEventListener("mousedown", handleClick);
    };
  }, [isActive, addEffect]);

  if (!isActive) return null;

  return (
    <div className={styles.sparkContainer}>
      {sparks.map((s) => (
        <div
          key={s.id}
          className={styles.spark}
          style={{ left: s.x, top: s.y }}
        >
          {s.label}
        </div>
      ))}
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: p.x,
            top: p.y,
            backgroundColor: p.color,
            // @ts-ignore
            "--tx": p.tx,
            "--ty": p.ty,
          }}
        />
      ))}
    </div>
  );
};

export default ClickSpark;


