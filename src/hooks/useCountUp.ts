// src/hooks/useCountUp.ts
import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  decimals?: number;
  startOnMount?: boolean;
}

interface UseCountUpReturn {
  value: number;
  start: () => void;
  reset: () => void;
  isAnimating: boolean;
}

/**
 * 数値のカウントアップアニメーションフック
 */
export function useCountUp({
  end,
  duration = 1000,
  decimals = 0,
  startOnMount = true
}: UseCountUpOptions): UseCountUpReturn {
  const [value, setValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  const easeOutQuart = (t: number): number => {
    return 1 - Math.pow(1 - t, 4);
  };

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutQuart(progress);
    
    const currentValue = easedProgress * end;
    setValue(parseFloat(currentValue.toFixed(decimals)));

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setIsAnimating(false);
      startTimeRef.current = null;
    }
  };

  const start = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    startTimeRef.current = null;
    setValue(0);
    animationRef.current = requestAnimationFrame(animate);
  };

  const reset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsAnimating(false);
    startTimeRef.current = null;
    setValue(0);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 初期開始
  useEffect(() => {
    if (startOnMount && end > 0) {
      start();
    }
  }, [end, startOnMount]);

  return { value, start, reset, isAnimating };
}