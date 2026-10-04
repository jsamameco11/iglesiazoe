import { usePage } from "@inertiajs/react";
import { useEffect, useId, useState } from "react";
import { readPairs } from "@/lib/copy";
import { useArt } from "@/lib/design";
import type { SiteSettings } from "@/lib/types";
import "../../../css/acceso-gate.css";

const fallback = [{ kicker: "Juan 1:1", line: "En el principio era el Verbo" }];
const tone = (color: string, amount: number, other: string) => `color-mix(in srgb, ${color} ${amount}%, ${other})`;
const FLIGHTS = ["left", "right", "top"] as const;
const SPARKS = [-26, -8, 12, 28];
const MOTES = [
  { x: 236, y: 300, r: 3, delay: 0 },
  { x: 488, y: 340, r: 2.4, delay: -2.6 },
  { x: 300, y: 220, r: 2, delay: -5.1 },
  { x: 430, y: 250, r: 2.8, delay: -7.4 },
  { x: 556, y: 420, r: 2.2, delay: -3.8 },
  { x: 170, y: 420, r: 2.6, delay: -6.2 },
];

/** Splits a verse into at most three lines that fit the label on the jar. */
function wrap(text: string, max = 23) {
  const lines: string[] = [];
  text.split(/\s+/).filter(Boolean).forEach((word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + word).length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  });
  if (lines.length > 3) lines.splice(2, lines.length - 2, lines.slice(2).join(" "));
  return lines.length ? lines : [""];
}

/** A sealed envelope with the Zoe mark, drawn around its own center. */
function Envelope({ seal }: { seal: string }) {
  return (
    <>
      <rect x="-42" y="-28" width="84" height="56" rx="5" fill="#fbf6ec" stroke="#e3d6c1" strokeWidth="1.5" />
      <path d="M-41 26 L-7 1 M41 26 L7 1" stroke="#e7dccb" strokeWidth="1.5" fill="none" />
      <path d="M-41 -27 L0 4 L41 -27 Z" fill="#f2e8d6" stroke="#e3d6c1" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="0" cy="4" r="11.5" style={{ fill: seal }} />
      <circle cx="0" cy="4" r="8.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
      <text x="0" y="8.6" textAnchor="middle" fill="#fff" fontSize="12.5" fontWeight="700" style={{ fontFamily: "var(--font-heading)" }}>
        Z
      </text>
    </>
  );
}

/** The amphora of the sign-in page: verses written on its label while the cells' envelopes drop in, one after another. */
export function AccesoGate() {
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const art = useArt("acceso");
  const colors = art.colors ?? {};
  const speed = art.speed ?? 1;
  const still = Boolean(art.still);
  const sky = colors.sky || "#f0e4d4";
  const desk = colors.desk || "#c9ae96";
  const jar = colors.jar || "#b86b43";
  const accent = colors.accent || "#c45c26";
  const gold = colors.gold || "#e0b062";
  const pairs = readPairs(settings, "acceso.lines").map((pair) => ({ kicker: pair.ref ? pair.text : "", line: pair.ref || pair.text }));
  const verses = pairs.length ? pairs : fallback;
  const uid = useId().replace(/:/g, "");
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const verse = verses[index % verses.length];
  const lines = wrap(verse.line);

  useEffect(() => {
    const total = verse.line.length;
    if (typed < total) {
      const timer = window.setTimeout(() => setTyped(still ? total : typed + 1), still ? 0 : 46 / speed);
      return () => window.clearTimeout(timer);
    }
    const pause = window.setTimeout(() => {
      setTyped(0);
      setIndex((current) => (current + 1) % verses.length);
    }, (still ? 5000 : 2600) / speed);
    return () => window.clearTimeout(pause);
  }, [verse.line, verses.length, typed, speed, still]);

  let rest = typed;
  const shown = lines.map((line) => {
    const part = line.slice(0, Math.max(0, rest));
    rest -= line.length + 1;
    return part;
  });
  const caretLine = Math.max(0, shown.reduce((last, part, i) => (part ? i : last), 0));
  const firstLine = 478 - (lines.length - 1) * 12;

  return (
    <div className="acceso-gate" data-art="acceso" aria-hidden="true">
      <div className="acceso-gate-glow" data-on="true" />
      <div className="acceso-gate-orb" />
      <div className="acceso-gate-scene">
        <svg viewBox="0 0 720 820" className="acceso-gate-art" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: tone(sky, 30, "#fff") }} />
              <stop offset="55%" style={{ stopColor: sky }} />
              <stop offset="100%" style={{ stopColor: tone(sky, 82, "#8d6b55") }} />
            </linearGradient>
            <linearGradient id={`${uid}desk`} gradientUnits="userSpaceOnUse" x1="0" y1="600" x2="0" y2="820">
              <stop offset="0%" style={{ stopColor: tone(desk, 88, "#fff") }} />
              <stop offset="100%" style={{ stopColor: tone(desk, 74, "#5a3a28") }} />
            </linearGradient>
            <linearGradient id={`${uid}jar`} gradientUnits="userSpaceOnUse" x1="214" y1="0" x2="506" y2="0">
              <stop offset="0%" style={{ stopColor: tone(jar, 62, "#3a1d10") }} />
              <stop offset="30%" style={{ stopColor: tone(jar, 78, "#ffe2c8") }} />
              <stop offset="58%" style={{ stopColor: jar }} />
              <stop offset="100%" style={{ stopColor: tone(jar, 52, "#2a140a") }} />
            </linearGradient>
            <linearGradient id={`${uid}rim`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: tone(jar, 70, "#ffe9d6") }} />
              <stop offset="100%" style={{ stopColor: tone(jar, 80, "#3a1d10") }} />
            </linearGradient>
            <radialGradient id={`${uid}mouth`} cx="0.5" cy="0.3" r="0.7">
              <stop offset="0%" style={{ stopColor: tone(jar, 30, "#120804") }} />
              <stop offset="100%" stopColor="#120804" />
            </radialGradient>
            <linearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: tone(gold, 62, "#fff6dc") }} />
              <stop offset="100%" style={{ stopColor: tone(gold, 84, "#8a5a1a") }} />
            </linearGradient>
            <linearGradient id={`${uid}label`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fdf9f1" />
              <stop offset="100%" stopColor="#f1e6d2" />
            </linearGradient>
            <radialGradient id={`${uid}halo`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" style={{ stopColor: gold, stopOpacity: 0.42 }} />
              <stop offset="60%" style={{ stopColor: gold, stopOpacity: 0.12 }} />
              <stop offset="100%" style={{ stopColor: gold, stopOpacity: 0 }} />
            </radialGradient>
            <filter id={`${uid}blur`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id={`${uid}shine`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            {/* Everything above the rim, plus the opening itself: an envelope below this line has gone into the jar. */}
            <clipPath id={`${uid}into`}>
              <rect x="-1200" y="-1600" width="3120" height="1858" />
              <ellipse cx="360" cy="258" rx="47" ry="9" />
            </clipPath>
          </defs>

          {/* Sky and floor run past the viewBox so a panel taller or wider than 720×820 shows more scene instead of an empty band. */}
          <rect x="-1200" y="-1600" width="3120" height="1610" style={{ fill: tone(sky, 30, "#fff") }} />
          <rect x="-1200" y="0" width="3120" height="820" fill={`url(#${uid}sky)`} />

          <circle cx="360" cy="400" r="300" fill={`url(#${uid}halo)`} />
          <g className="acceso-rays">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M360 400 L346 40 L374 40 Z" style={{ fill: gold }} opacity="0.07" transform={`rotate(${i * 30} 360 400)`} />
            ))}
          </g>
          <circle className="acceso-mote acceso-mote-slow" cx="110" cy="130" r="46" fill="#f4e7db" opacity="0.7" />
          <circle className="acceso-mote" cx="630" cy="170" r="60" fill="#e9dfd3" opacity="0.5" />

          <path d="M-1200 700 L0 652 C200 622 520 622 720 652 L1920 700 V2400 H-1200 Z" fill={`url(#${uid}desk)`} />
          <path d="M-1200 712 L0 664 C200 636 520 636 720 664 L1920 712" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />

          <g className="acceso-lamp-oil" transform="translate(84 600)">
            <ellipse cx="62" cy="72" rx="58" ry="9" fill="#5a3a28" opacity="0.2" />
            <ellipse className="acceso-flame-glow" cx="104" cy="16" rx="34" ry="34" style={{ fill: gold }} opacity="0.35" filter={`url(#${uid}blur)`} />
            <path d="M18 52 C18 34 42 28 66 28 C88 28 104 36 110 40 L124 38 C128 38 128 44 124 46 L106 52 C100 64 82 70 62 70 C36 70 18 64 18 52 Z" style={{ fill: tone(jar, 85, "#3a1d10") }} />
            <path d="M28 46 C40 38 78 36 96 42" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="60" cy="36" rx="12" ry="4" fill="#2a160c" opacity="0.55" />
            <path className="acceso-flame" d="M118 38 C110 26 112 14 120 2 C128 14 130 26 122 38 Z" style={{ fill: gold }} />
            <path className="acceso-flame" d="M119.5 36 C115 28 116 20 120 13 C124 20 125 28 120.5 36 Z" fill="#fff6dc" />
          </g>

          <g className="acceso-pile" transform="translate(548 628)">
            <ellipse cx="62" cy="50" rx="66" ry="9" fill="#5a3a28" opacity="0.18" />
            <g transform="translate(62 40) rotate(-4) scale(0.92)"><Envelope seal={accent} /></g>
            <g transform="translate(58 22) rotate(5) scale(0.92)"><Envelope seal={accent} /></g>
            <g className="acceso-pile-top" transform="translate(66 4) rotate(-2) scale(0.92)"><Envelope seal={accent} /></g>
          </g>

          <ellipse cx="360" cy="668" rx="128" ry="16" fill="#5a3a28" opacity="0.24" />

          <g className="acceso-jar">
            <path
              d="M318 266 C318 290 324 304 326 318 C250 336 214 392 214 452 C214 540 270 600 316 626 L310 652 H410 L404 626 C450 600 506 540 506 452 C506 392 470 336 394 318 C396 304 402 290 402 266 Z"
              fill={`url(#${uid}jar)`}
            />
            <path d="M324 282 C268 268 236 300 256 352" fill="none" style={{ stroke: tone(jar, 72, "#3a1d10") }} strokeWidth="13" strokeLinecap="round" />
            <path d="M396 282 C452 268 484 300 464 352" fill="none" style={{ stroke: tone(jar, 72, "#3a1d10") }} strokeWidth="13" strokeLinecap="round" />
            <path d="M324 282 C272 271 242 300 258 346" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="3" strokeLinecap="round" />
            <rect x="302" y="648" width="116" height="16" rx="5" style={{ fill: tone(jar, 70, "#2a140a") }} />
            <path d="M262 350 Q360 374 458 350" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="4" />
            <path d="M268 362 Q360 384 452 362" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="1.5" opacity="0.8" />
            {Array.from({ length: 9 }, (_, i) => (
              <circle key={i} cx={296 + i * 16} cy={334 + Math.abs(i - 4) * -1.2 + 4} r="2.2" style={{ fill: gold }} opacity="0.85" />
            ))}
            <path d="M232 562 Q360 590 488 562" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="4" />
            <path d="M246 578 Q360 604 474 578" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="1.5" opacity="0.8" />
            <ellipse cx="262" cy="452" rx="20" ry="92" fill="#fff" opacity="0.14" filter={`url(#${uid}shine)`} />

            <rect x="242" y="404" width="236" height="132" rx="16" fill={`url(#${uid}label)`} stroke={`url(#${uid}gold)`} strokeWidth="2.5" />
            <rect x="250" y="412" width="220" height="116" rx="11" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="1" opacity="0.55" />
            <text x="360" y="434" textAnchor="middle" style={{ fill: tone(accent, 82, "#3a1d10"), fontFamily: "var(--font-accent)" }} fontSize="10" fontWeight="600" letterSpacing="2.6">
              {(verse.kicker || "Iglesia Zoe").toUpperCase()}
            </text>
            <path d="M340 444 H380" stroke={`url(#${uid}gold)`} strokeWidth="1.5" />
            <text textAnchor="middle" fill="#2c241e" style={{ fontFamily: "var(--font-heading)" }} fontSize="19" fontWeight="500" fontStyle="italic">
              {shown.map((part, i) => (
                <tspan key={i} x="360" y={firstLine + i * 24}>
                  {part}
                  {i === caretLine && <tspan className="acceso-caret">|</tspan>}
                </tspan>
              ))}
            </text>
          </g>

          <ellipse cx="360" cy="258" rx="58" ry="13" fill={`url(#${uid}rim)`} />
          <ellipse cx="360" cy="258" rx="47" ry="9" fill={`url(#${uid}mouth)`} />
          <ellipse className="acceso-mouth-glow" cx="360" cy="246" rx="70" ry="30" style={{ fill: gold }} filter={`url(#${uid}blur)`} />

          <g clipPath={`url(#${uid}into)`}>
            {still ? (
              <g transform="translate(360 236) rotate(-7)"><Envelope seal={accent} /></g>
            ) : (
              FLIGHTS.map((flight, i) => (
                <g key={flight} transform="translate(360 196)">
                  <g className="acceso-envelope" data-flight={flight} style={{ animationDelay: `${i * -2.5}s` }}>
                    <Envelope seal={accent} />
                  </g>
                </g>
              ))
            )}
          </g>

          <path d="M302 262 C318 272 402 272 418 262" fill="none" style={{ stroke: tone(jar, 72, "#ffe9d6") }} strokeWidth="3" strokeLinecap="round" opacity="0.9" />

          {!still && SPARKS.map((dx, i) => (
            <path
              key={dx}
              className="acceso-spark"
              d="M360 240 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z"
              style={{ fill: tone(gold, 70, "#fff"), ["--dx" as string]: `${dx}px`, animationDelay: `${0.1 + i * 0.08}s` }}
            />
          ))}
          {MOTES.map((mote) => (
            <circle key={`${mote.x}-${mote.y}`} className="acceso-dust" cx={mote.x} cy={mote.y} r={mote.r} style={{ fill: tone(gold, 60, "#fff"), animationDelay: `${mote.delay}s` }} />
          ))}
        </svg>
      </div>
    </div>
  );
}
