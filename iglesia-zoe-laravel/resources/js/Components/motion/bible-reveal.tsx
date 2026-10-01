import { useId, useLayoutEffect, useRef, useState } from "react";

const leaf = "M0 0 C14 -9 34 -8 46 0 C34 8 14 9 0 0 Z";

const branchA: [number, number, number][] = [
  [399, 29, 176], [399, 29, 80],
  [368, 68, 180], [368, 68, 84],
  [336, 107, 178], [336, 107, 82],
  [303, 146, 182], [303, 146, 86],
  [269, 185, 180], [269, 185, 88],
  [234, 224, 184], [234, 224, 92],
  [210, 250, 132],
];

const branchB: [number, number, number][] = [
  [416, 92, 160], [416, 92, 64],
  [394, 144, 164], [394, 144, 66],
  [372, 196, 162], [372, 196, 62],
  [350, 248, 166], [350, 248, 68],
  [330, 300, 113],
];

function Branch({ stem, leaves, className }: { stem: string; leaves: [number, number, number][]; className: string }) {
  return (
    <g className={`luz-branch ${className}`}>
      <path d={stem} stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      {leaves.map(([x, y, angle], index) => (
        <path
          key={index}
          d={leaf}
          fill="currentColor"
          transform={`translate(${x} ${y}) rotate(${angle}) scale(${index === leaves.length - 1 ? 1.1 : 0.92 + (index % 3) * 0.06})`}
        />
      ))}
    </g>
  );
}

export function BibleReveal() {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const band = node.closest(".luz-quote") || node;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const play = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        play();
        observer.disconnect();
      },
      { threshold: 0.22, rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(band);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="luz-bible-wrap" data-state={shown ? "shown" : "hidden"} aria-hidden="true">
      <svg className="luz-leaves" viewBox="0 0 460 340" fill="none">
        <Branch stem="M430 -10 Q330 120 210 250" leaves={branchA} className="luz-branch-a" />
        <Branch stem="M440 40 Q380 170 330 300" leaves={branchB} className="luz-branch-b" />
      </svg>

      <svg viewBox="0 0 300 280" className="luz-bible-art">
        <defs>
          <linearGradient id={`${uid}leather`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a2a24" />
            <stop offset="55%" stopColor="#2b1f1b" />
            <stop offset="100%" stopColor="#1e1613" />
          </linearGradient>
          <linearGradient id={`${uid}spine`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a1210" />
            <stop offset="100%" stopColor="#30231e" />
          </linearGradient>
          <linearGradient id={`${uid}gilt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f1dea6" />
            <stop offset="50%" stopColor="#d4ad5c" />
            <stop offset="100%" stopColor="#a87d34" />
          </linearGradient>
          <linearGradient id={`${uid}sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <ellipse cx="156" cy="258" rx="112" ry="10" fill="#1f2024" opacity="0.12" />

        <g className="luz-bible-book" transform="rotate(-6 150 140)">
          <rect x="72" y="42" width="170" height="210" rx="10" fill="#1a1210" />
          <rect x="68" y="38" width="168" height="206" rx="8" fill={`url(#${uid}gilt)`} />
          <path d="M232 46 V238 M234.5 48 V236 M76 240 H228 M78 242.5 H226" stroke="#fff6dc" strokeWidth="0.8" opacity="0.55" />

          <rect x="60" y="30" width="170" height="210" rx="10" fill={`url(#${uid}leather)`} />
          <rect x="60" y="30" width="18" height="210" rx="6" fill={`url(#${uid}spine)`} />
          <path d="M60 62 H78 M60 94 H78 M60 176 H78 M60 208 H78" stroke="#4a3830" strokeWidth="1.5" />
          <rect x="60" y="30" width="170" height="210" rx="10" fill={`url(#${uid}sheen)`} />

          <rect x="90" y="46" width="126" height="178" rx="6" stroke={`url(#${uid}gilt)`} strokeWidth="1.4" fill="none" />
          <rect x="95" y="51" width="116" height="168" rx="4" stroke={`url(#${uid}gilt)`} strokeWidth="0.6" fill="none" opacity="0.7" />

          <rect x="148" y="78" width="10" height="80" rx="2" fill={`url(#${uid}gilt)`} />
          <rect x="128" y="100" width="50" height="10" rx="2" fill={`url(#${uid}gilt)`} />

          <text
            x="153"
            y="190"
            textAnchor="middle"
            fill={`url(#${uid}gilt)`}
            fontFamily="'Cormorant Garamond', 'Times New Roman', serif"
            fontSize="10"
            fontWeight="600"
            letterSpacing="3.2"
          >
            SANTA BIBLIA
          </text>

          <g className="luz-bible-ribbon">
            <path d="M194 238 V268 L199 262 L204 268 V238 Z" fill="#a8452f" />
            <path d="M194 238 V266" stroke="#c9644a" strokeWidth="1" />
          </g>
        </g>
      </svg>
    </div>
  );
}
