import { useState, useRef, useEffect } from "react";

type Position = {
    x: number;
    y: number;
};

type UseDraggableProps = {
    initialPosition?: Position;
    onDragEnd?: () => void;
    onClick?: () => void;
    disabled?: boolean;
};

export function useDraggable({
    initialPosition,
    onDragEnd,
    onClick,
    disabled = false,
}: UseDraggableProps = {}) {
    const [position, setPosition] = useState<Position>(
        initialPosition || { x: window.innerWidth - 84, y: window.innerHeight - 84 }
    );
    const isDragging = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const ref = useRef<HTMLButtonElement>(null);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setPosition({ x: window.innerWidth - 84, y: window.innerHeight - 84 });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;

        isDragging.current = false;
        dragStartPos.current = { x: e.clientX, y: e.clientY };

        const el = ref.current;
        if (!el) return;
        el.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (disabled || !ref.current?.hasPointerCapture(e.pointerId)) return;

        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging.current = true;
        }

        if (isDragging.current) {
            setPosition((prev) => ({
                x: prev.x + e.movementX,
                y: prev.y + e.movementY,
            }));
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        ref.current?.releasePointerCapture(e.pointerId);

        if (!isDragging.current) {
            onClick?.();
        } else {
            onDragEnd?.();
        }
        isDragging.current = false;
    };

    return {
        position,
        ref,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
        },
    };
}
