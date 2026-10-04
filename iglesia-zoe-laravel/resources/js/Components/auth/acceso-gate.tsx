import { usePage } from "@inertiajs/react";
import { useEffect, useId, useState } from "react";
import { readPairs } from "@/lib/copy";
import { useArt } from "@/lib/design";
import type { SiteSettings } from "@/lib/types";
import "../../../css/acceso-gate.css";

const fallback = [{ kicker: "Juan 1:1", line: "En el principio era el Verbo" }];
const tone = (color: string, amount: number, other: string) => `color-mix(in srgb, ${color} ${amount}%, ${other})`;
const FLIGHTS = ["left", "right", "top"] as const;
const SPARKS = [-30, -10, 10, 30];
const MOTES = [
  { x: 150, y: 300, r: 3, delay: 0 },
  { x: 560, y: 330, r: 2.4, delay: -2.6 },
  { x: 290, y: 210, r: 2, delay: -5.1 },
  { x: 440, y: 240, r: 2.8, delay: -7.4 },
  { x: 600, y: 470, r: 2.2, delay: -3.8 },
  { x: 120, y: 460, r: 2.6, delay: -6.2 },
];
const BODY_GRAIN = Array.from({ length: 12 }, (_, i) => ({ y: 382 + i * 22, bend: i % 2 ? 4 : -3 }));
const LID_GRAIN = Array.from({ length: 7 }, (_, i) => ({ front: 184 + (i + 1) * 44, back: 226 + (i + 1) * 33.5, bend: i % 2 ? 3 : -3 }));
const PILE = [
  { x: 282, y: 618, turn: -9 },
  { x: 444, y: 620, turn: 8 },
  { x: 352, y: 624, turn: 3 },
  { x: 406, y: 614, turn: -5 },
  { x: 316, y: 610, turn: 11 },
];
const CORNERS = ["", "translate(720 0) scale(-1 1)", "translate(0 1014) scale(1 -1)", "translate(720 1014) scale(-1 -1)"];

/** Splits a verse into at most three lines that fit the plaque on the box. */
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

/** The wooden ballot box of the sign-in page: verses written on its plaque while the cells' envelopes drop through the slot. */
export function AccesoGate() {
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const art = useArt("acceso");
  const colors = art.colors ?? {};
  const speed = art.speed ?? 1;
  const still = Boolean(art.still);
  const sky = colors.sky || "#f0e4d4";
  const desk = colors.desk || "#c9ae96";
  const wood = colors.jar || "#9a6238";
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
  const firstLine = 480 - (lines.length - 1) * 11;
  const dark = (amount: number) => tone(wood, amount, "#24110a");
  const light = (amount: number) => tone(wood, amount, "#ffe8cc");

  const flights = (copy: string) =>
    FLIGHTS.map((flight, i) => (
      <g key={`${copy}-${flight}`} transform="translate(360 295)">
        <g className="acceso-envelope" data-flight={flight} style={{ animationDelay: `${i * -2.5}s` }}>
          <Envelope seal={accent} />
        </g>
      </g>
    ));

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
            <linearGradient id={`${uid}wood`} gradientUnits="userSpaceOnUse" x1="184" y1="0" x2="536" y2="0">
              <stop offset="0%" style={{ stopColor: dark(66) }} />
              <stop offset="20%" style={{ stopColor: light(84) }} />
              <stop offset="52%" style={{ stopColor: wood }} />
              <stop offset="100%" style={{ stopColor: dark(58) }} />
            </linearGradient>
            <linearGradient id={`${uid}lid`} gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="346">
              <stop offset="0%" style={{ stopColor: light(70) }} />
              <stop offset="100%" style={{ stopColor: light(86) }} />
            </linearGradient>
            <linearGradient id={`${uid}panel`} gradientUnits="userSpaceOnUse" x1="0" y1="392" x2="0" y2="626">
              <stop offset="0%" style={{ stopColor: dark(80) }} />
              <stop offset="100%" style={{ stopColor: light(92) }} />
            </linearGradient>
            <linearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: tone(gold, 58, "#fff6dc") }} />
              <stop offset="55%" style={{ stopColor: gold }} />
              <stop offset="100%" style={{ stopColor: tone(gold, 74, "#7a4c12") }} />
            </linearGradient>
            <linearGradient id={`${uid}label`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fdf9f1" />
              <stop offset="100%" stopColor="#f1e6d2" />
            </linearGradient>
            <linearGradient id={`${uid}depth`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#120804" stopOpacity="0.6" />
              <stop offset="55%" stopColor="#120804" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#120804" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id={`${uid}glint`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={`${uid}halo`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" style={{ stopColor: gold, stopOpacity: 0.42 }} />
              <stop offset="60%" style={{ stopColor: gold, stopOpacity: 0.12 }} />
              <stop offset="100%" style={{ stopColor: gold, stopOpacity: 0 }} />
            </radialGradient>
            <filter id={`${uid}blur`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            {/* Everything above the slot's front edge: an envelope below this line has gone into the box. */}
            <clipPath id={`${uid}into`}>
              <rect x="-1200" y="-1600" width="3120" height="1928" />
            </clipPath>
            <clipPath id={`${uid}window`}>
              <rect x="242" y="532" width="236" height="84" rx="7" />
            </clipPath>
            <clipPath id={`${uid}body`}>
              <rect x="198" y="372" width="324" height="270" />
            </clipPath>
            <clipPath id={`${uid}top`}>
              <path d="M226 300 H494 L536 346 H184 Z" />
            </clipPath>
          </defs>

          {/* Sky and floor run past the viewBox so a panel taller or wider than 720×820 shows more scene instead of an empty band. */}
          <rect x="-1200" y="-1600" width="3120" height="1610" style={{ fill: tone(sky, 30, "#fff") }} />
          <rect x="-1200" y="0" width="3120" height="820" fill={`url(#${uid}sky)`} />

          <circle cx="360" cy="400" r="320" fill={`url(#${uid}halo)`} />
          <g className="acceso-rays">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M360 400 L346 40 L374 40 Z" style={{ fill: gold }} opacity="0.07" transform={`rotate(${i * 30} 360 400)`} />
            ))}
          </g>
          <circle className="acceso-mote acceso-mote-slow" cx="110" cy="130" r="46" fill="#f4e7db" opacity="0.7" />
          <circle className="acceso-mote" cx="630" cy="170" r="60" fill="#e9dfd3" opacity="0.5" />

          <path d="M-1200 700 L0 652 C200 622 520 622 720 652 L1920 700 V2400 H-1200 Z" fill={`url(#${uid}desk)`} />
          <path d="M-1200 712 L0 664 C200 636 520 636 720 664 L1920 712" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />

          <g transform="translate(26 606)">
            <ellipse cx="62" cy="72" rx="58" ry="9" fill="#5a3a28" opacity="0.2" />
            <ellipse className="acceso-flame-glow" cx="104" cy="16" rx="34" ry="34" style={{ fill: gold }} opacity="0.35" filter={`url(#${uid}blur)`} />
            <path d="M18 52 C18 34 42 28 66 28 C88 28 104 36 110 40 L124 38 C128 38 128 44 124 46 L106 52 C100 64 82 70 62 70 C36 70 18 64 18 52 Z" style={{ fill: dark(80) }} />
            <path d="M28 46 C40 38 78 36 96 42" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="60" cy="36" rx="12" ry="4" fill="#2a160c" opacity="0.55" />
            <path className="acceso-flame" d="M118 38 C110 26 112 14 120 2 C128 14 130 26 122 38 Z" style={{ fill: gold }} />
            <path className="acceso-flame" d="M119.5 36 C115 28 116 20 120 13 C124 20 125 28 120.5 36 Z" fill="#fff6dc" />
          </g>

          <g transform="translate(552 628)">
            <ellipse cx="62" cy="50" rx="66" ry="9" fill="#5a3a28" opacity="0.18" />
            <g transform="translate(62 40) rotate(-4) scale(0.92)"><Envelope seal={accent} /></g>
            <g transform="translate(58 22) rotate(5) scale(0.92)"><Envelope seal={accent} /></g>
            <g transform="translate(66 4) rotate(-2) scale(0.92)"><Envelope seal={accent} /></g>
          </g>

          <ellipse cx="360" cy="670" rx="196" ry="17" fill="#3a2418" opacity="0.26" />

          <g className="acceso-box">
            {/* Body: a frame with a recessed panel, grain and brass corners. */}
            <rect x="198" y="372" width="324" height="270" fill={`url(#${uid}wood)`} />
            <g clipPath={`url(#${uid}body)`} fill="none" style={{ stroke: dark(55) }} strokeWidth="1.2" opacity="0.22">
              {BODY_GRAIN.map(({ y, bend }) => (
                <path key={y} d={`M198 ${y} C260 ${y + bend} 300 ${y - bend} 360 ${y + 1} S470 ${y + bend} 522 ${y - 2}`} />
              ))}
            </g>
            <rect x="222" y="392" width="276" height="234" rx="4" fill={`url(#${uid}panel)`} />
            <path d="M222 394 V392 H498" fill="none" style={{ stroke: dark(40) }} strokeWidth="3" opacity="0.7" />
            <path d="M222 626 H498 V394" fill="none" style={{ stroke: light(50) }} strokeWidth="2" opacity="0.55" />
            <ellipse cx="472" cy="604" rx="8" ry="3.2" fill="none" style={{ stroke: dark(45) }} strokeWidth="1.2" opacity="0.35" />
            <ellipse cx="248" cy="420" rx="6" ry="2.4" fill="none" style={{ stroke: dark(45) }} strokeWidth="1.2" opacity="0.3" />

            {/* Brass plaque where the verse writes itself. */}
            <rect x="240" y="404" width="240" height="116" rx="10" fill={`url(#${uid}label)`} stroke={`url(#${uid}gold)`} strokeWidth="3.5" />
            <rect x="248" y="412" width="224" height="100" rx="6" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="1" opacity="0.6" />
            {[[252, 416], [468, 416], [252, 508], [468, 508]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r="3.4" fill={`url(#${uid}gold)`} />
                <path d={`M${x - 2} ${y + 1.6} L${x + 2} ${y - 1.6}`} stroke="#7a4c12" strokeWidth="0.9" />
              </g>
            ))}
            <text x="360" y="430" textAnchor="middle" style={{ fill: tone(accent, 82, "#3a1d10"), fontFamily: "var(--font-accent)" }} fontSize="10" fontWeight="600" letterSpacing="2.6">
              {(verse.kicker || "Iglesia Zoe").toUpperCase()}
            </text>
            <path d="M340 440 H380" stroke={`url(#${uid}gold)`} strokeWidth="1.5" />
            <text textAnchor="middle" fill="#2c241e" style={{ fontFamily: "var(--font-heading)" }} fontSize="19" fontWeight="500" fontStyle="italic">
              {shown.map((part, i) => (
                <tspan key={i} x="360" y={firstLine + i * 22}>
                  {part}
                  {i === caretLine && <tspan className="acceso-caret">|</tspan>}
                </tspan>
              ))}
            </text>

            {/* Glass window: the envelopes are seen landing on the pile inside. */}
            <rect x="242" y="532" width="236" height="84" rx="7" style={{ fill: dark(36) }} />
            <g clipPath={`url(#${uid}window)`}>
              {PILE.map((item) => (
                <g key={`${item.x}-${item.y}`} transform={`translate(${item.x} ${item.y}) rotate(${item.turn}) scale(0.8)`}>
                  <Envelope seal={accent} />
                </g>
              ))}
              {!still && flights("inside")}
              <rect x="242" y="532" width="236" height="84" fill={`url(#${uid}depth)`} />
              <rect x="242" y="532" width="236" height="84" fill="#fff" opacity="0.05" />
              <path d="M262 532 H286 L252 616 H228 Z M298 532 H306 L272 616 H264 Z" fill="#fff" opacity="0.12" />
              {!still && <path className="acceso-glint" d="M200 532 H250 L206 616 H156 Z" fill={`url(#${uid}glint)`} />}
            </g>
            <rect x="242" y="532" width="236" height="84" rx="7" fill="none" stroke={`url(#${uid}gold)`} strokeWidth="4" />
            <rect x="246" y="536" width="228" height="76" rx="5" fill="none" stroke="#24110a" strokeOpacity="0.35" strokeWidth="1" />

            {CORNERS.map((transform) => (
              <g key={transform || "base"} transform={transform || undefined}>
                <path d="M198 372 H236 V380 H206 V410 H198 Z" fill={`url(#${uid}gold)`} />
                <circle cx="203" cy="377" r="2" fill="#7a4c12" opacity="0.7" />
                <circle cx="226" cy="376.5" r="1.6" fill="#7a4c12" opacity="0.6" />
                <circle cx="202" cy="400" r="1.6" fill="#7a4c12" opacity="0.6" />
              </g>
            ))}

            {/* Plinth and feet. */}
            <rect x="186" y="640" width="348" height="20" rx="3" style={{ fill: dark(70) }} />
            <path d="M188 641 H532" style={{ stroke: light(60) }} strokeWidth="1.5" opacity="0.5" />
            <rect x="196" y="658" width="30" height="10" rx="2" style={{ fill: dark(58) }} />
            <rect x="494" y="658" width="30" height="10" rx="2" style={{ fill: dark(58) }} />

            {/* Lid: top face with the slot, a moulded front band and the brass lock. */}
            <path d="M226 300 H494 L536 346 H184 Z" fill={`url(#${uid}lid)`} />
            <g clipPath={`url(#${uid}top)`} fill="none" style={{ stroke: dark(55) }} strokeWidth="1.1" opacity="0.18">
              {LID_GRAIN.map(({ front, back, bend }) => (
                <path key={front} d={`M${front} 346 Q${(front + back) / 2 + bend} 323 ${back} 300`} />
              ))}
            </g>
            <path d="M226 300 H494" style={{ stroke: light(40) }} strokeWidth="2" opacity="0.6" />
            <path d="M286 333 H434 L427 313 H293 Z" fill={`url(#${uid}gold)`} />
            <path d="M296 328 H424 L420 318 H300 Z" fill="#140904" />
            <path d="M300 319 H420" stroke="#000" strokeOpacity="0.5" strokeWidth="2" />
            <rect x="184" y="346" width="352" height="26" style={{ fill: dark(84) }} />
            <rect x="184" y="346" width="352" height="26" fill={`url(#${uid}wood)`} opacity="0.55" />
            <path d="M184 347 H536" style={{ stroke: light(55) }} strokeWidth="2" opacity="0.7" />
            <path d="M184 371 H536" stroke="#24110a" strokeOpacity="0.45" strokeWidth="2" />
            <rect x="184" y="346" width="16" height="26" fill={`url(#${uid}gold)`} />
            <rect x="520" y="346" width="16" height="26" fill={`url(#${uid}gold)`} />
            <rect x="345" y="352" width="30" height="34" rx="5" fill={`url(#${uid}gold)`} stroke="#7a4c12" strokeOpacity="0.4" />
            <circle cx="360" cy="364" r="3.6" fill="#2a160c" />
            <path d="M358.4 365 L357.6 374 H362.4 L361.6 365 Z" fill="#2a160c" />
          </g>

          <ellipse className="acceso-slot-glow" cx="360" cy="316" rx="88" ry="26" style={{ fill: gold }} filter={`url(#${uid}blur)`} />

          <g clipPath={`url(#${uid}into)`}>
            {still ? <g transform="translate(360 312)"><Envelope seal={accent} /></g> : flights("above")}
          </g>

          {!still && SPARKS.map((dx, i) => (
            <path
              key={dx}
              className="acceso-spark"
              d="M360 304 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z"
              style={{ fill: tone(gold, 70, "#fff"), ["--dx" as string]: `${dx}px`, animationDelay: `${i * 0.06}s` }}
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
