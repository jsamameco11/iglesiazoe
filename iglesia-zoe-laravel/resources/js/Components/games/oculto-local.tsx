import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { PlayerTile, RoundHistory, RoundOutcome, RoundTag, SpeakerRow, Verdict, WordSummary, maxRounds, winnerOf, type RoundEntry } from "@/Components/games/oculto-parts";
import { OCULTO_DEFAULTS, OcultoSettingsForm, type OcultoSettings } from "@/Components/games/oculto-settings";
import { RevealCard } from "@/Components/games/reveal-card";
import { Alert, Avatar, EndActions, field, ghost, primary, useScreenTop } from "@/Components/games/ui";
import { getJson, query, shuffle, type OcultoCard, type Theme } from "@/lib/games";

type Phase = "setup" | "pass" | "card" | "clues" | "vote" | "reveal" | "result";
type Seat = { name: string; impostor: boolean };
type Round = RoundEntry & { out: number | null };

const TIE = -1;

/**
 * El Cristiano Oculto on one phone that goes from hand to hand: everyone opens their card,
 * gives one clue per round, and the group taps the player they vote out.
 */
export function OcultoLocal({ themes, onExit }: { themes: Theme[]; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  useScreenTop(phase);
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [settings, setSettings] = useState<OcultoSettings>(OCULTO_DEFAULTS);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [alive, setAlive] = useState<number[]>([]);
  const [word, setWord] = useState<OcultoCard | null>(null);
  const [cursor, setCursor] = useState(0);
  const [round, setRound] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [history, setHistory] = useState<Round[]>([]);
  const [winner, setWinner] = useState<"group" | "hidden" | null>(null);
  const [suspect, setSuspect] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filled = names.map((name) => name.trim()).filter(Boolean);

  async function start() {
    setError("");
    if (filled.length < 3) return setError("Se necesitan al menos 3 jugadores.");
    if (new Set(filled.map((name) => name.toLowerCase())).size !== filled.length) return setError("Hay nombres repetidos. Usa uno distinto para cada jugador.");
    const impostors = filled.length >= 5 ? settings.impostors : 1;
    setBusy(true);
    const reply = await getJson<{ word: OcultoCard }>(`/juegos/el-cristiano-oculto/palabra?${query({ temas: settings.categories, nivel: settings.level })}`);
    setBusy(false);
    if (reply.error || !reply.word) return setError(reply.error || "No hay palabras para estos temas.");
    const picked = new Set(shuffle(filled.map((_, index) => index)).slice(0, impostors));
    setSeats(filled.map((name, index) => ({ name, impostor: picked.has(index) })));
    setAlive(filled.map((_, index) => index));
    setWord(reply.word);
    setRounds(maxRounds(filled.length));
    setRound(1);
    setHistory([]);
    setWinner(null);
    setCursor(0);
    setPhase("pass");
  }

  function seen() {
    if (cursor + 1 < seats.length) {
      setCursor(cursor + 1);
      return setPhase("pass");
    }
    setCursor(0);
    setPhase("clues");
  }

  function nextClue() {
    if (cursor + 1 < alive.length) return setCursor(cursor + 1);
    setSuspect(null);
    setPhase("vote");
  }

  function confirmVote() {
    if (suspect === null) return;
    const out = suspect === TIE ? null : suspect;
    const left = out === null ? alive : alive.filter((seat) => seat !== out);
    const hiddenLeft = left.filter((seat) => seats[seat].impostor).length;
    setAlive(left);
    setHistory([...history, { round, out, name: out === null ? null : seats[out].name, hidden: out !== null && seats[out].impostor }]);
    setWinner(winnerOf(left.length, hiddenLeft, round, rounds));
    setPhase("reveal");
  }

  function afterReveal() {
    if (winner) return setPhase("result");
    setRound(round + 1);
    setCursor(0);
    setPhase("clues");
  }

  if (phase === "setup") {
    return (
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Rise className="game-surface p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="game-label">Un solo celular</p>
              <h2 className="editorial mt-2 text-3xl">Jugadores</h2>
            </div>
            <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold text-ink">{filled.length} / 15</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">Escribe un nombre por persona, en el orden en que están sentados.</p>
          <ol className="mt-6 grid gap-2.5">
            {names.map((name, position) => (
              <li key={position} className="flex items-center gap-3">
                <Avatar name={name.trim() || String(position + 1)} />
                <input value={name} maxLength={24} onChange={(event) => setNames(names.map((item, at) => (at === position ? event.target.value : item)))} placeholder={`Jugador ${position + 1}`} className={field} />
                {names.length > 3 ? (
                  <button type="button" aria-label={`Quitar jugador ${position + 1}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-sage hover:text-ink" onClick={() => setNames(names.filter((_, at) => at !== position))}>
                    ✕
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
          {names.length < 15 ? (
            <button type="button" className={`${ghost} mt-4 w-full`} onClick={() => setNames([...names, ""])}>
              + Agregar jugador
            </button>
          ) : null}
          <p className="mt-5 rounded-2xl bg-sage/60 px-4 py-3 text-sm leading-6 text-ink/80">
            {filled.length <= 3 ? "Con 3 jugadores se juega 1 ronda." : `Con ${filled.length} jugadores se juegan hasta ${maxRounds(filled.length)} rondas.`} Si descubren al oculto antes, la partida termina ahí.
          </p>
        </Rise>
        <Rise delay={80} className="game-surface p-6 md:p-8">
          <OcultoSettingsForm themes={themes} value={settings} onChange={setSettings} players={filled.length} />
          {error ? <div className="mt-6"><Alert>{error}</Alert></div> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className={primary} onClick={() => void start()} disabled={busy}>
              {busy ? "Eligiendo palabra…" : "Repartir tarjetas"}
            </button>
            <button type="button" className={ghost} onClick={onExit}>
              Volver
            </button>
          </div>
        </Rise>
      </div>
    );
  }

  const player = seats[cursor];
  const speakers = alive.map((seat) => seats[seat].name);
  const out = seats.filter((_, index) => !alive.includes(index)).map((seat) => seat.name);

  if (phase === "pass" && player) {
    return (
      <Hand kicker={`Tarjeta ${cursor + 1} de ${seats.length}`} name={player.name} title={`Pasa el celular a ${player.name}`} text="Que solo esa persona mire la pantalla.">
        <Dots total={seats.length} at={cursor} />
        <button type="button" className={`${primary} mt-8 w-full sm:w-auto`} onClick={() => setPhase("card")} autoFocus>
          Soy {player.name}, ver mi tarjeta
        </button>
      </Hand>
    );
  }

  if (phase === "card" && player && word) {
    return (
      <div className="mt-10">
        <RevealCard owner={player.name} card={player.impostor ? { impostor: true, category: word.category, level: word.level } : { ...word, impostor: false }} onClose={seen} closeLabel={cursor + 1 < seats.length ? "Listo, pasar al siguiente" : "Listo, empezar las pistas"} />
      </div>
    );
  }

  if (phase === "clues") {
    const speaker = speakers[cursor];
    return (
      <Rise className="game-surface mx-auto mt-10 max-w-2xl p-7 text-center md:p-10">
        <RoundTag round={round} rounds={rounds} label="Pistas" />
        <Avatar name={speaker} size="xl" className="mx-auto mt-7" />
        <p className="editorial mt-5 text-4xl leading-tight">Turno de {speaker}</p>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-muted">Di en voz alta una palabra o frase corta relacionada con la palabra secreta, sin decirla.</p>
        <div className="mt-7">
          <SpeakerRow names={speakers} current={cursor} out={out} />
        </div>
        <button type="button" className={`${primary} mt-8 w-full sm:w-auto`} onClick={nextClue} autoFocus>
          {cursor + 1 < alive.length ? "Ya di mi pista" : "Ir a la votación"}
        </button>
      </Rise>
    );
  }

  if (phase === "vote") {
    const chosen = suspect !== null && suspect !== TIE ? seats[suspect].name : null;
    return (
      <Rise className="game-surface mx-auto mt-10 max-w-3xl p-6 md:p-10">
        <div className="text-center">
          <RoundTag round={round} rounds={rounds} label="Votación" />
          <h2 className="editorial mt-5 text-[2.1rem] leading-tight md:text-5xl">¿Quién es el Cristiano Oculto?</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-muted">Conversen, voten a mano alzada y toquen al jugador con más votos.</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {alive.map((seat) => (
            <PlayerTile key={seat} name={seats[seat].name} selected={suspect === seat} onClick={() => setSuspect(seat)} />
          ))}
        </div>
        <button type="button" onClick={() => setSuspect(TIE)} aria-pressed={suspect === TIE} className={`mt-3 w-full rounded-[1.3rem] border border-dashed px-4 py-3.5 text-sm font-semibold transition ${suspect === TIE ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink/30 hover:text-ink"}`}>
          Hubo empate: nadie sale
        </button>
        <button type="button" className={`${primary} mt-7 w-full`} disabled={suspect === null} onClick={confirmVote}>
          {chosen ? `Confirmar: sale ${chosen}` : suspect === TIE ? "Confirmar empate" : "Elige a un jugador"}
        </button>
      </Rise>
    );
  }

  if (phase === "reveal") {
    const entry = history[history.length - 1];
    return (
      <Rise className="game-surface mx-auto mt-10 max-w-2xl p-7 md:p-10">
        <RoundOutcome entry={entry}>
          <p className="mx-auto mt-7 max-w-md text-[15px] leading-7 text-muted">
            {winner === "group"
              ? "¡Lo encontraron! Toquen el botón para ver la palabra secreta."
              : winner === "hidden"
                ? "Se acabaron las rondas. Veamos quién era el Cristiano Oculto."
                : `El Cristiano Oculto sigue entre ustedes. Quedan ${alive.length} jugadores para la ronda ${round + 1}.`}
          </p>
          <button type="button" className={`${primary} mt-7 w-full sm:w-auto`} onClick={afterReveal} autoFocus>
            {winner ? "Ver el resultado final" : `Empezar la ronda ${round + 1}`}
          </button>
        </RoundOutcome>
      </Rise>
    );
  }

  return (
    <div className="mx-auto mt-10 grid max-w-3xl gap-5">
      <Verdict winner={winner ?? "hidden"} impostors={seats.filter((seat) => seat.impostor).map((seat) => seat.name)} />
      {word ? <WordSummary word={word} /> : null}
      <RoundHistory rounds={history} />
      <EndActions
        onLobby={() => setPhase("setup")}
        onExit={onExit}
        lobbyText="Los mismos jugadores, listos para repartir otra vez."
        exitText="Vuelve al menú de El Cristiano Oculto."
      />
    </div>
  );
}

function Hand({ kicker, name, title, text, children }: { kicker: string; name: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <Rise className="game-dark mx-auto mt-10 max-w-xl p-8 text-center md:p-12">
      <p className="game-label">{kicker}</p>
      <Avatar name={name} size="xl" className="mx-auto mt-7" />
      <p className="editorial mt-6 text-4xl leading-tight text-white">{title}</p>
      {text ? <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-white/70">{text}</p> : null}
      {children}
    </Rise>
  );
}

function Dots({ total, at }: { total: number; at: number }) {
  return (
    <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`h-1.5 rounded-full transition-all ${index === at ? "w-6 bg-accent" : index < at ? "w-1.5 bg-white/60" : "w-1.5 bg-white/20"}`} />
      ))}
    </div>
  );
}