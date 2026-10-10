import { Avatar, Check } from "@/Components/games/ui";
import type { OcultoCard } from "@/lib/games";

/** 3 players play one round; every extra player adds one, up to 8. */
export const maxRounds = (players: number) => (players <= 3 ? 1 : Math.min(players - 2, 8));

/** The group wins when no hidden player is left; the hidden ones when they match the faithful or the rounds run out. */
export function winnerOf(alive: number, hiddenLeft: number, round: number, rounds: number): "group" | "hidden" | null {
  if (!hiddenLeft) return "group";
  if (hiddenLeft * 2 >= alive || round >= rounds) return "hidden";
  return null;
}

export type RoundEntry = { round: number; name: string | null; hidden: boolean; tally?: { name: string; votes: number }[] };

export function RoundTag({ round, rounds, label }: { round: number; rounds: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-xs font-semibold text-ink">
      <span className="rounded-full bg-accent px-2.5 py-1 text-white">
        Ronda {round} de {rounds}
      </span>
      {label}
    </span>
  );
}

/** A player to vote for: tap to choose, tap the confirm button to send. */
export function PlayerTile({ name, selected, onClick, disabled, note }: { name: string; selected: boolean; onClick: () => void; disabled?: boolean; note?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex min-h-20 items-center gap-3 rounded-[1.3rem] border p-3.5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "game-pop border-accent bg-accent-soft ring-4 ring-accent/15" : "border-line bg-card hover:-translate-y-0.5 hover:border-ink/30"
      }`}
    >
      <Avatar name={name} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{name}</span>
        {note ? <span className="block truncate text-xs text-muted">{note}</span> : null}
      </span>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${selected ? "border-accent bg-accent text-white" : "border-line"}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
    </button>
  );
}

/** Who left the game in a round, and whether they were the hidden one. */
export function RoundOutcome({ entry, children }: { entry: RoundEntry; children?: React.ReactNode }) {
  const total = entry.tally?.reduce((sum, row) => sum + row.votes, 0) ?? 0;
  return (
    <div className="game-pop text-center">
      <p className="game-label">Resultado de la ronda {entry.round}</p>
      {entry.name ? (
        <>
          <Avatar name={entry.name} size="xl" className="mx-auto mt-6" />
          <p className="editorial mt-5 text-4xl leading-tight">{entry.name} sale del juego</p>
          <p className={`mx-auto mt-4 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${entry.hidden ? "bg-emerald-600 text-white" : "bg-accent-soft text-accent"}`}>
            {entry.hidden ? "¡Era el Cristiano Oculto!" : "No era el Cristiano Oculto"}
          </p>
        </>
      ) : (
        <>
          <span className="mx-auto mt-6 grid h-20 w-20 place-items-center rounded-full bg-sage text-3xl font-bold text-ink">=</span>
          <p className="editorial mt-5 text-4xl leading-tight">Hubo empate</p>
          <p className="mt-3 text-[15px] text-muted">Nadie sale en esta ronda.</p>
        </>
      )}
      {entry.tally?.length ? (
        <ul className="mx-auto mt-7 grid max-w-sm gap-2 text-left">
          {entry.tally.map((row) => (
            <li key={row.name} className="flex items-center gap-3">
              <Avatar name={row.name} size="sm" />
              <span className="w-24 truncate text-sm font-medium text-ink">{row.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sage">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${total ? (row.votes / total) * 100 : 0}%` }} />
              </span>
              <span className="w-14 text-right text-xs font-semibold tabular-nums text-muted">
                {row.votes} {row.votes === 1 ? "voto" : "votos"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

/** The end of a game: who won and who was hidden all along. */
export function Verdict({ winner, impostors, mine }: { winner: "group" | "hidden"; impostors: string[]; mine?: { impostor: boolean } }) {
  const many = impostors.length > 1;
  const won = mine ? (mine.impostor ? winner === "hidden" : winner === "group") : null;
  return (
    <div className="game-dark game-pop p-7 text-center md:p-12">
      <p className="game-label">Fin de la partida</p>
      <h2 className="editorial mt-4 text-[2.4rem] leading-[1.05] text-white md:text-6xl">
        {winner === "group" ? (many ? "¡Descubrieron a los ocultos!" : "¡Descubrieron al Cristiano Oculto!") : many ? "¡Ganaron los ocultos!" : "¡Ganó el Cristiano Oculto!"}
      </h2>
      <p className="mt-6 text-[15px] text-white/70">{many ? "Los cristianos ocultos eran" : "El Cristiano Oculto era"}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-4">
        {impostors.map((name) => (
          <div key={name} className="flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.07] py-2 pl-2 pr-5">
            <Avatar name={name} size="lg" />
            <span className="text-xl font-semibold text-white">{name}</span>
          </div>
        ))}
      </div>
      {won !== null ? (
        <p className={`mx-auto mt-7 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${won ? "bg-emerald-500 text-white" : "bg-white/10 text-white/85"}`}>
          {mine?.impostor ? (won ? "Eras el oculto y nadie te descubrió" : "Eras el oculto y te descubrieron") : won ? "¡Tu grupo ganó!" : "Esta vez se les escapó"}
        </p>
      ) : null}
    </div>
  );
}

export function RoundHistory({ rounds }: { rounds: RoundEntry[] }) {
  if (!rounds.length) return null;
  return (
    <div className="game-surface p-6 md:p-7">
      <p className="game-label">Rondas</p>
      <ol className="mt-4 grid gap-3">
        {rounds.map((entry) => (
          <li key={entry.round} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage text-sm font-bold text-ink">{entry.round}</span>
            {entry.name ? <Avatar name={entry.name} size="sm" /> : null}
            <span className="min-w-0 flex-1 text-[15px] text-ink">{entry.name ? <><strong>{entry.name}</strong> salió</> : "Empate, nadie salió"}</span>
            {entry.name ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.hidden ? "bg-emerald-50 text-emerald-800" : "bg-accent-soft text-accent"}`}>{entry.hidden ? "Era oculto" : "Era fiel"}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WordSummary({ word }: { word: OcultoCard }) {
  return (
    <div className="secret-card is-summary p-7 text-left md:p-8">
      <span className="secret-frame" />
      <p className="game-label">Palabra secreta · {word.category}</p>
      <p className="editorial mt-3 text-4xl leading-tight">{word.word}</p>
      {word.description ? <p className="mt-3 text-[15px] leading-7 text-muted">{word.description}</p> : null}
      {word.reference ? <p className="mt-2 text-sm font-semibold text-accent">{word.reference}</p> : null}
      {word.clues?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {word.clues.map((clue) => (
            <span key={clue} className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-ink">
              {clue}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The players of a round in speaking order: who already spoke, who speaks now and who is out. */
export function SpeakerRow({ names, current, out = [], me }: { names: string[]; current: number; out?: string[]; me?: string }) {
  return (
    <ol className="flex flex-wrap justify-center gap-2">
      {names.map((name, index) => (
        <li
          key={name}
          className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition ${
            index === current ? "border-accent bg-accent text-white" : index < current ? "border-line bg-sage/70 text-muted" : "border-line bg-card text-ink"
          }`}
        >
          <Avatar name={name} size="sm" />
          {name}
          {name === me ? " (tú)" : ""}
          {index < current ? <Check className="h-3.5 w-3.5" /> : null}
        </li>
      ))}
      {out.map((name) => (
        <li key={name} className="flex items-center gap-2 rounded-full border border-dashed border-line py-1 pl-1 pr-3 text-xs font-medium text-muted line-through opacity-70">
          <Avatar name={name} size="sm" className="grayscale" />
          {name}
        </li>
      ))}
    </ol>
  );
}
