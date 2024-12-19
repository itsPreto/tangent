// src/lib/utils.js
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { useState, useEffect, useRef } from 'react';


export const useFPSMonitor = () => {
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    const interval = 1000; // 1 second
    const update = () => {
      const now = performance.now();
      const delta = now - lastTime.current;
      const currentFps = (frameCount.current / delta) * 1000;
      setFps(currentFps);
      frameCount.current = 0;
      lastTime.current = now;
    };

    const raf = () => {
      frameCount.current += 1;
      requestAnimationFrame(raf);
    };

    const fpsInterval = setInterval(update, interval);
    requestAnimationFrame(raf);

    return () => {
      clearInterval(fpsInterval);
    };
  }, []);

  return fps;
};


export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
