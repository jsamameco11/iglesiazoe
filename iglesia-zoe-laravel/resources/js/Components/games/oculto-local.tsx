import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { RevealCard } from "@/Components/games/reveal-card";
import { Alert, Chip, Field, field, ghost, primary } from "@/Components/games/ui";
import { getJson, query, shuffle, type OcultoCard, type Theme } from "@/lib/games";

type Phase = "setup" | "reveal-prompt" | "card" | "clues" | "vote-prompt" | "vote-ballot" | "escaped" | "result";
type Seat = { name: string; impostor: boolean };

const CLUE_PASSES = 2;

/** 3 players play one round; every extra player adds one, up to 8. */
export const maxRounds = (players: number) => (players <= 3 ? 1 : Math.min(players - 2, 8));

function tally(votes: number[], seats: Seat[]) {
  const counts = new Map<number, number>();
  votes.forEach((vote) => counts.set(vote, (counts.get(vote) ?? 0) + 1));
  let top: number | null = null;
  let best = 0;
  let ties = 0;
  for (const [seat, count] of counts) {
    if (count > best) {
      top = seat;
      best = count;
      ties = 1;
    } else if (count === best) ties += 1;
  }
  const caught = top !== null && ties === 1 && seats[top]?.impostor === true && best * 2 > votes.length;
  return { top: ties === 1 ? top : null, caught };
}

/** El Cristiano Oculto on one phone that goes from hand to hand. */
export function OcultoLocal({ themes, onExit }: { themes: Theme[]; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [chosen, setChosen] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [hidden, setHidden] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [word, setWord] = useState<OcultoCard | null>(null);
  const [cursor, setCursor] = useState(0);
  const [pass, setPass] = useState(1);
  const [round, setRound] = useState(1);
  const [votes, setVotes] = useState<number[]>([]);
  const [suspect, setSuspect] = useState<number | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filled = names.map((name) => name.trim()).filter(Boolean);
  const cap = maxRounds(Math.max(filled.length, 3));

  async function start() {
    setError("");
    if (filled.length < 3) return setError("Se necesitan al menos 3 jugadores.");
    if (new Set(filled.map((name) => name.toLowerCase())).size !== filled.length) return setError("Hay nombres repetidos. Usa uno distinto para cada jugador.");
    const impostors = filled.length >= 5 ? hidden : 1;
    setBusy(true);
    const reply = await getJson<{ word: OcultoCard }>(`/juegos/el-cristiano-oculto/palabra?${query({ temas: chosen })}`);
    setBusy(false);
    if (reply.error || !reply.word) return setError(reply.error || "No hay palabras para estos temas.");
    const picked = new Set(shuffle(filled.map((_, index) => index)).slice(0, impostors));
    setSeats(filled.map((name, index) => ({ name, impostor: picked.has(index) })));
    setWord(reply.word);
    setRounds(Math.min(rounds, maxRounds(filled.length)));
    setRound(1);
    setCursor(0);
    setPass(1);
    setVotes([]);
    setTop(null);
    setPhase("reveal-prompt");
  }

  function seen() {
    if (cursor + 1 < seats.length) {
      setCursor(cursor + 1);
      return setPhase("reveal-prompt");
    }
    setCursor(0);
    setPass(1);
    setPhase("clues");
  }

  function nextClue() {
    if (cursor + 1 < seats.length) return setCursor(cursor + 1);
    if (pass < CLUE_PASSES) {
      setPass(pass + 1);
      return setCursor(0);
    }
    setCursor(0);
    setVotes([]);
    setPhase("vote-prompt");
  }

  function castVote() {
    if (suspect === null) return;
    const ballots = [...votes, suspect];
    setVotes(ballots);
    setSuspect(null);
    if (cursor + 1 < seats.length) {
      setCursor(cursor + 1);
      return setPhase("vote-prompt");
    }
    const result = tally(ballots, seats);
    setTop(result.top);
    if (!result.caught && round < rounds) {
      setRound(round + 1);
      setCursor(0);
      setPass(1);
      return setPhase("escaped");
    }
    setPhase("result");
  }

  const player = seats[cursor];
  const impostorNames = seats.filter((seat) => seat.impostor).map((seat) => seat.name);
  const caught = top !== null && seats[top]?.impostor === true;

  if (phase === "setup") {
    return (
      <Rise className="panel mt-12 p-6 md:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="editorial text-3xl text-ink">Un solo celular</h2>
          <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={onExit}>← Volver</button>
        </div>
        <div className="mt-8 grid gap-8">
          <Field label="Jugadores" hint="Escribe un nombre por persona, en el orden en que están sentados.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {names.map((name, position) => (
                <div key={position} className="flex gap-2">
                  <input value={name} maxLength={24} onChange={(event) => setNames(names.map((item, at) => (at === position ? event.target.value : item)))} placeholder={`Jugador ${position + 1}`} className={field} />
                  {names.length > 3 ? (
                    <button type="button" aria-label="Quitar jugador" className="px-2 text-muted hover:text-ink" onClick={() => setNames(names.filter((_, at) => at !== position))}>✕</button>
                  ) : null}
                </div>
              ))}
            </div>
            {names.length < 15 ? <button type="button" className={`${ghost} mt-3`} onClick={() => setNames([...names, ""])}>+ Agregar jugador</button> : null}
          </Field>
          <Field label="Temas" hint="Sin elegir ninguno, la palabra sale de cualquier tema.">
            <div className="flex flex-wrap gap-2">
              <Chip active={!chosen.length} onClick={() => setChosen([])}>Todos</Chip>
              {themes.map((theme) => (
                <Chip key={theme.id} active={chosen.includes(theme.id)} onClick={() => setChosen(chosen.includes(theme.id) ? chosen.filter((id) => id !== theme.id) : [...chosen, theme.id])}>
                  {theme.name}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="grid gap-8 md:grid-cols-2">
            <Field label="Cristianos ocultos" hint={filled.length < 5 ? "Con menos de 5 jugadores se juega con uno." : undefined}>
              <div className="flex gap-2">
                {[1, 2].map((count) => (
                  <Chip key={count} active={(filled.length >= 5 ? hidden : 1) === count} disabled={count === 2 && filled.length < 5} onClick={() => setHidden(count)}>{count}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Rondas" hint={cap === 1 ? "Con 3 jugadores se juega una ronda." : "Si no lo descubren, escapa y se juega otra ronda con la misma palabra."}>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: cap }, (_, at) => at + 1).map((count) => (
                  <Chip key={count} active={Math.min(rounds, cap) === count} onClick={() => setRounds(count)}>{count}</Chip>
                ))}
              </div>
            </Field>
          </div>
          {error ? <Alert>{error}</Alert> : null}
          <div>
            <button type="button" className={primary} onClick={() => void start()} disabled={busy}>{busy ? "Eligiendo palabra…" : "Repartir tarjetas"}</button>
          </div>
        </div>
      </Rise>
    );
  }

  if (phase === "reveal-prompt" && player) {
    return (
      <Hand kicker={`Tarjeta ${cursor + 1} de ${seats.length}`} title={`Pasa el celular a ${player.name}`} text="Que solo esa persona mire la pantalla.">
        <button type="button" className={`${primary} mt-8`} onClick={() => setPhase("card")} autoFocus>Soy {player.name}</button>
      </Hand>
    );
  }

  if (phase === "card" && player && word) {
    return (
      <div className="mt-12">
        <RevealCard card={player.impostor ? { impostor: true, category: word.category } : { ...word, impostor: false }} onClose={seen} closeLabel={cursor + 1 < seats.length ? "Listo, pasar al siguiente" : "Listo, empezar las pistas"} />
      </div>
    );
  }

  if (phase === "clues" && player) {
    return (
      <Hand kicker={`Ronda ${round} de ${rounds} · Vuelta ${pass} de ${CLUE_PASSES}`} title={`Turno de ${player.name}`} text="Di en voz alta una sola palabra o frase corta relacionada con la palabra secreta, sin decirla.">
        <ol className="mt-7 flex flex-wrap justify-center gap-2">
          {seats.map((seat, at) => (
            <li key={seat.name} className={`rounded-full px-3 py-1 text-xs font-medium ${at === cursor ? "bg-accent text-white" : at < cursor ? "bg-sage text-muted line-through" : "border border-line text-muted"}`}>{seat.name}</li>
          ))}
        </ol>
        <button type="button" className={`${primary} mt-8`} onClick={nextClue} autoFocus>
          {cursor + 1 < seats.length || pass < CLUE_PASSES ? "Ya di mi pista" : "Pasar a la votación"}
        </button>
      </Hand>
    );
  }

  if (phase === "vote-prompt" && player) {
    return (
      <Hand kicker={`Votación · ${cursor + 1} de ${seats.length}`} title={`Pasa el celular a ${player.name}`} text="Cada uno vota en secreto por quien cree que es el Cristiano Oculto.">
        <button type="button" className={`${primary} mt-8`} onClick={() => setPhase("vote-ballot")} autoFocus>Soy {player.name}, votar</button>
      </Hand>
    );
  }

  if (phase === "vote-ballot" && player) {
    return (
      <Rise className="panel mx-auto mt-12 max-w-xl p-7 md:p-10">
        <p className="kicker">Voto de {player.name}</p>
        <h2 className="editorial mt-3 text-3xl text-ink">¿Quién es el Cristiano Oculto?</h2>
        <div className="mt-7 grid gap-2">
          {seats.map((seat, at) =>
            at === cursor ? null : (
              <button key={seat.name} type="button" onClick={() => setSuspect(at)} className={`rounded-2xl border px-5 py-3.5 text-left font-medium transition ${suspect === at ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink/30"}`}>
                {seat.name}
              </button>
            ),
          )}
        </div>
        <button type="button" className={`${primary} mt-7 w-full`} disabled={suspect === null} onClick={castVote}>Confirmar voto</button>
      </Rise>
    );
  }

  if (phase === "escaped") {
    return (
      <Hand kicker={`Termina la ronda ${round - 1}`} title="¡Escapó!" text={`${top !== null ? `La mayoría señaló a ${seats[top].name}, pero no era.` : "No hubo una mayoría clara."} El Cristiano Oculto sigue entre ustedes. Misma palabra, nueva ronda de pistas.`}>
        <button type="button" className={`${primary} mt-8`} onClick={() => setPhase("clues")} autoFocus>Empezar ronda {round}</button>
      </Hand>
    );
  }

  return (
    <Rise className="panel mx-auto mt-12 max-w-2xl p-7 text-center md:p-10">
      <p className="kicker">Resultado</p>
      <p className={`editorial mt-4 text-5xl leading-tight ${caught ? "text-ink" : "text-accent"}`}>{caught ? "¡Lo descubrieron!" : "¡Ganó el Cristiano Oculto!"}</p>
      <p className="mt-4 text-[15px] leading-7 text-muted">
        {impostorNames.length > 1 ? "Los cristianos ocultos eran" : "El Cristiano Oculto era"} <strong className="text-ink">{impostorNames.join(" y ")}</strong>.
      </p>
      {word ? <WordSummary word={word} /> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" className={primary} onClick={() => void start()}>Otra partida</button>
        <button type="button" className={ghost} onClick={() => setPhase("setup")}>Cambiar jugadores</button>
      </div>
    </Rise>
  );
}

export function WordSummary({ word }: { word: OcultoCard }) {
  return (
    <div className="mt-7 rounded-[1.4rem] bg-sage/70 p-5 text-left md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Palabra secreta · {word.category}</p>
      <p className="editorial mt-2 text-3xl text-ink">{word.word}</p>
      {word.description ? <p className="mt-2 text-[15px] leading-7 text-ink/80">{word.description}</p> : null}
      {word.reference ? <p className="mt-2 text-sm font-semibold text-accent">{word.reference}</p> : null}
      {word.clues?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {word.clues.map((clue) => (
            <span key={clue} className="rounded-full border border-accent/25 bg-card px-3 py-1 text-xs font-medium text-ink">{clue}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Hand({ kicker, title, text, children }: { kicker: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <Rise className="panel mx-auto mt-12 max-w-xl p-8 text-center md:p-12">
      <p className="kicker">{kicker}</p>
      <p className="editorial mt-4 text-4xl leading-tight text-ink">{title}</p>
      {text ? <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-muted">{text}</p> : null}
      {children}
    </Rise>
  );
}
