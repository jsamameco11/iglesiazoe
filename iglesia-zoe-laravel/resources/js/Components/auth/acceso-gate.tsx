import { usePage } from "@inertiajs/react";
import { useEffect, useId, useState } from "react";
import { readPairs } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

const fallback = [{ kicker: "CEREAL", line: "Informe de tu grupo" }];

export function AccesoGate() {
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const pairs = readPairs(settings, "acceso.lines").map((pair) => ({ kicker: pair.ref ? pair.text : "", line: pair.ref || pair.text }));
  const verses = pairs.length ? pairs : fallback;
  const uid = useId().replace(/:/g, "");
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const verse = verses[index % verses.length];

  useEffect(() => {
    const word = verse.line;
    if (typed.length < word.length) {
      const timer = window.setTimeout(() => setTyped(word.slice(0, typed.length + 1)), 42);
      return () => window.clearTimeout(timer);
    }
    const pause = window.setTimeout(() => {
      setTyped("");
      setIndex((current) => (current + 1) % verses.length);
    }, 2200);
    return () => window.clearTimeout(pause);
  }, [verse.line, verses.length, typed]);

  return (
    <div className="acceso-gate" aria-hidden="true">
      <div className="acceso-gate-glow" data-on="true" />
      <div className="acceso-gate-orb" />
      <div className="acceso-gate-scene">
        <svg viewBox="0 0 720 820" className="acceso-gate-art" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbf6ee" />
              <stop offset="52%" stopColor="#f0e4d4" />
              <stop offset="100%" stopColor="#e2cfb8" />
            </linearGradient>
            <linearGradient id={`${uid}desk`} gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="720" y2="820">
              <stop offset="0%" stopColor="#c9ae96" />
              <stop offset="100%" stopColor="#a8876e" />
            </linearGradient>
            <linearGradient id={`${uid}wood`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d7bfa8" />
              <stop offset="100%" stopColor="#b59276" />
            </linearGradient>
            <linearGradient id={`${uid}screen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2b3342" />
              <stop offset="100%" stopColor="#12161d" />
            </linearGradient>
            <linearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0d090" />
              <stop offset="100%" stopColor="#c7923d" />
            </linearGradient>
            <linearGradient id={`${uid}page`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fbfaf6" />
              <stop offset="100%" stopColor="#efe6d8" />
            </linearGradient>
            <filter id={`${uid}soft`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Sky and desk run past the viewBox so a panel taller or wider than 720×820 shows more scene instead of an empty band. */}
          <rect x="-1200" y="-1600" width="3120" height="1610" fill="#fbf6ee" />
          <rect x="-1200" y="0" width="3120" height="820" fill={`url(#${uid}sky)`} />
          <circle className="acceso-mote" cx="86" cy="94" r="54" fill="#f4e7db" opacity="0.85" />
          <circle className="acceso-mote acceso-mote-slow" cx="628" cy="128" r="72" fill="#e4ddd4" opacity="0.55" />

          <path d="M-1200 560 L0 470 C160 428 390 448 720 400 L1920 310 V2400 H-1200 Z" fill={`url(#${uid}desk)`} />
          <path d="M-1200 600 L0 508 C240 470 470 492 720 454 L1920 364" fill="none" stroke="#8d6b55" strokeWidth="2" opacity="0.28" />

          <g className="acceso-plant">
            <ellipse cx="118" cy="528" rx="36" ry="10" fill="#6b4a38" opacity="0.18" />
            <path d="M118 470 C96 430 128 400 118 368" fill="none" stroke="#8d5a3c" strokeWidth="4" strokeLinecap="round" />
            <ellipse className="acceso-leaf" cx="96" cy="392" rx="22" ry="12" fill="#c48a62" transform="rotate(-28 96 392)" />
            <ellipse className="acceso-leaf" cx="138" cy="404" rx="24" ry="13" fill="#a56b48" transform="rotate(22 138 404)" />
            <ellipse cx="118" cy="430" rx="18" ry="10" fill="#b88968" />
            <rect x="104" y="468" width="28" height="36" rx="8" fill="#c45c26" />
          </g>

          <g className="acceso-lamp">
            <rect x="572" y="312" width="10" height="92" rx="4" fill="#2a2f34" />
            <path d="M540 312 H614 L600 268 H554 Z" fill="#1f2328" />
            <ellipse cx="577" cy="268" rx="28" ry="10" fill={`url(#${uid}gold)`} opacity="0.9" />
            <ellipse className="acceso-lamp-glow" cx="577" cy="360" rx="70" ry="36" fill="#f0d090" opacity="0.18" />
          </g>

          <g className="acceso-machine">
            <rect x="168" y="118" width="384" height="252" rx="22" fill="#1c2024" />
            <rect x="182" y="132" width="356" height="216" rx="12" fill={`url(#${uid}screen)`} />
            <rect x="182" y="132" width="356" height="216" rx="12" fill="#c7923d" opacity="0.06" />
            <circle cx="360" cy="124" r="3" fill="#5c6570" />
            <text x="204" y="172" fill="#c5cbb8" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="500" letterSpacing="3.2">
              {verse.kicker ? `IGLESIA ZOE · ${verse.kicker}` : "IGLESIA ZOE"}
            </text>
            <text x="204" y="228" fill="#fbfaf6" fontFamily="'Cormorant Garamond', serif" fontSize="25" fontWeight="500" fontStyle="italic">
              {typed}
              <tspan className="acceso-caret">|</tspan>
            </text>
            <rect x="204" y="268" width="168" height="10" rx="5" fill="#3b4554" />
            <rect x="204" y="286" width="112" height="10" rx="5" fill="#323a47" />
            <rect x="204" y="312" width="118" height="18" rx="9" fill="#fbfaf6" />
            <text x="263" y="325" textAnchor="middle" fill="#1a1a1a" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600">
              Ingresar
            </text>
            <circle cx="498" cy="320" r="16" fill="#edd9a8" />
            <path d="M498 312 v9 M493.5 321 h9" stroke="#8d5430" strokeWidth="2" strokeLinecap="round" />

            <path d="M148 372 H572 L600 404 H120 Z" fill="#2a3036" />
            <rect x="120" y="400" width="480" height="78" rx="14" fill={`url(#${uid}wood)`} />
            <g className="acceso-keys">
              {Array.from({ length: 12 }, (_, i) => (
                <rect
                  key={i}
                  x={148 + i * 36}
                  y="418"
                  width="26"
                  height="16"
                  rx="4"
                  fill={i === 6 ? "#e8c57a" : "#f4efe6"}
                  className="acceso-key"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </g>
            <rect x="292" y="444" width="136" height="18" rx="6" fill="#1c2024" />
          </g>

          <g className="acceso-bible" transform="translate(40 128)">
            <ellipse cx="268" cy="650" rx="164" ry="22" fill="#6b3f32" opacity="0.18" />
            <path
              d="M118 516 C118 496 154 484 204 484 H268 V520 V640 H188 C140 640 118 616 118 588 Z"
              fill="#6b3f32"
            />
            <path
              d="M418 516 C418 496 382 484 332 484 H268 V520 V640 H348 C396 640 418 616 418 588 Z"
              fill="#7a4a3b"
            />
            <path d="M132 528 H254 V620 H156 C138 620 132 604 132 590 Z" fill={`url(#${uid}page)`} />
            <path d="M404 528 H282 V620 H380 C398 620 404 604 404 590 Z" fill={`url(#${uid}page)`} />
            <path d="M268 484 V640" stroke={`url(#${uid}gold)`} strokeWidth="6" />
            <path d="M148 548 H240 M148 566 H228 M148 584 H220" stroke="#c3b7a6" strokeWidth="3" strokeLinecap="round" />
            <path d="M388 548 H296 M388 566 H308 M388 584 H316" stroke="#c3b7a6" strokeWidth="3" strokeLinecap="round" />
            <path className="acceso-ribbon" d="M268 484 C284 520 252 560 278 640" fill="none" stroke="#c45c26" strokeWidth="7" strokeLinecap="round" />
            <circle cx="268" cy="470" r="18" fill={`url(#${uid}gold)`} filter={`url(#${uid}soft)`} />
            <text x="268" y="476" textAnchor="middle" fontSize="16">
              ✝
            </text>
          </g>

          <g className="acceso-cup" transform="translate(70 70)">
            <ellipse cx="520" cy="574" rx="30" ry="8" fill="#6b4a38" opacity="0.16" />
            <path d="M498 520 h44 v32 c0 12 -10 20 -22 20 s-22 -8 -22 -20 Z" fill="#fbfaf6" />
            <path d="M542 528 c18 0 22 12 14 22" fill="none" stroke="#d7c4b0" strokeWidth="4" />
            <path className="acceso-steam" d="M512 508 C508 496 516 492 512 480" fill="none" stroke="#d7c4b0" strokeWidth="3" strokeLinecap="round" />
            <path className="acceso-steam acceso-mote-slow" d="M528 508 C532 496 522 492 528 480" fill="none" stroke="#d7c4b0" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
}
