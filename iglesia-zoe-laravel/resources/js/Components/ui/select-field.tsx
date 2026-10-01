import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type SelectOption = { value: string; label: string; prefix?: ReactNode; hint?: string };

const RENDER_LIMIT = 250;

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function SelectField({
  label,
  name,
  value,
  options,
  onChange,
  placeholder = "Selecciona",
  optional = false,
  disabled = false,
  loading = false,
  error,
  searchable,
  compact = false,
  className = "",
  renderValue,
}: {
  label: string;
  name?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  searchable?: boolean;
  compact?: boolean;
  className?: string;
  renderValue?: (option: SelectOption) => ReactNode;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const withSearch = searchable ?? options.length > 8;
  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return options;
    const starts: SelectOption[] = [];
    const contains: SelectOption[] = [];
    for (const option of options) {
      const hay = fold(`${option.label} ${option.hint ?? ""}`);
      if (hay.startsWith(needle)) starts.push(option);
      else if (hay.includes(needle)) contains.push(option);
    }
    return [...starts, ...contains];
  }, [options, query]);
  const visible = matches.slice(0, RENDER_LIMIT);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    setActive(index);
    requestAnimationFrame(() => {
      if (withSearch) search.current?.focus();
      else list.current?.focus();
      list.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };

  const choose = (option: SelectOption) => {
    onChange(option.value);
    close();
  };

  const onListKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(visible.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(visible.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  const onTriggerKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const unavailable = disabled || loading;

  return (
    <div ref={root} className={`select-field ${className}`.trim()} data-open={open ? "true" : "false"} data-invalid={error ? "true" : "false"}>
      <span id={`${id}-label`} className="text-sm">
        {label}
        {optional && <span className="select-field-optional"> (opcional)</span>}
      </span>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={trigger}
        type="button"
        className={`select-field-trigger ${compact ? "is-compact" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-invalid={error ? true : undefined}
        disabled={unavailable}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKey}
      >
        <span id={`${id}-value`} className={`select-field-value ${selected ? "" : "is-placeholder"}`}>
          {loading ? "Cargando…" : selected ? (renderValue ? renderValue(selected) : <>{selected.prefix}{selected.label}</>) : placeholder}
        </span>
        <svg viewBox="0 0 20 20" className="select-field-chevron" aria-hidden="true">
          <path d="m5.5 7.75 4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {error && <span className="select-field-error">{error}</span>}

      {open && (
        <div className="select-field-panel">
          {withSearch && (
            <div className="select-field-search">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                ref={search}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                placeholder="Buscar…"
                aria-label={`Buscar ${label.toLowerCase()}`}
                aria-controls={`${id}-list`}
                autoComplete="off"
              />
            </div>
          )}
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            className="select-field-list"
            onKeyDown={withSearch ? undefined : onListKey}
          >
            {visible.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className="select-field-option"
                  data-active={index === active ? "true" : "false"}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  {option.prefix}
                  <span className="select-field-option-label">{option.label}</span>
                  {option.hint && <span className="select-field-option-hint">{option.hint}</span>}
                  {isSelected && (
                    <svg viewBox="0 0 20 20" className="select-field-check" aria-hidden="true">
                      <path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              );
            })}
            {!visible.length && <li className="select-field-empty">Sin resultados</li>}
            {matches.length > RENDER_LIMIT && (
              <li className="select-field-empty">Escribe para ver más opciones ({matches.length.toLocaleString("es-PE")})</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
