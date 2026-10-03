import { useEffect, useRef } from "react";
import { meterLevel } from "@/lib/radio";

/** Vertical level meter with peak hold, fed by an AnalyserNode. */
export function Meter({ analyser, className = "" }: { analyser: AnalyserNode | null; className?: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  const peak = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!analyser) {
      if (bar.current) bar.current.style.height = "0%";
      if (peak.current) peak.current.style.bottom = "0%";
      return;
    }
    const buffer = new Float32Array(analyser.fftSize);
    let hold = 0;
    let holdAt = 0;
    let frame = 0;
    const draw = () => {
      const { level } = meterLevel(analyser, buffer);
      const now = performance.now();
      if (level >= hold || now - holdAt > 1200) {
        hold = level;
        holdAt = now;
      }
      if (bar.current) bar.current.style.height = `${(level * 100).toFixed(1)}%`;
      if (peak.current) peak.current.style.bottom = `calc(${(hold * 100).toFixed(1)}% - 2px)`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return (
    <div className={`studio-meter ${className}`} aria-hidden>
      <span ref={bar} />
      <i ref={peak} />
    </div>
  );
}

/** Spectrum bars of the program; calm idle bars while nothing plays. */
export function Visualizer({ analyser, active, className = "", speed = 1, still = false }: { analyser: AnalyserNode | null; active: boolean; className?: string; speed?: number; still?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const bars = 48;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const reduced = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const draw = (time: number) => {
      const rgb = (getComputedStyle(el).color.match(/[\d.]+/g) ?? ["255", "255", "255"]).slice(0, 3).join(", ");
      const ratio = window.devicePixelRatio || 1;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (el.width !== width * ratio || el.height !== height * ratio) {
        el.width = width * ratio;
        el.height = height * ratio;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (analyser && data && active) analyser.getByteFrequencyData(data);
      const gap = 3;
      const w = (width - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        let value: number;
        if (analyser && data && active) {
          const index = Math.floor(Math.pow(i / bars, 1.6) * (data.length * 0.72));
          value = data[index] / 255;
        } else {
          value = reduced ? 0.08 : 0.06 + 0.05 * Math.abs(Math.sin((time * speed) / 900 + i * 0.45));
        }
        const h = Math.max(3, value * height);
        const gradient = ctx.createLinearGradient(0, height, 0, height - h);
        gradient.addColorStop(0, `rgba(${rgb}, 0.85)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0.25)`);
        ctx.fillStyle = gradient;
        const x = i * (w + gap);
        ctx.beginPath();
        ctx.roundRect(x, height - h, w, h, Math.min(3, w / 2));
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, active, speed, still]);

  return <canvas ref={canvas} className={className} aria-hidden />;
}
