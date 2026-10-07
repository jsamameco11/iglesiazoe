const FALLBACK_LEVELS = ["Nueva Vida", "Enraizados", "Grandeza del Servicio", "Discipulado", "Visión Celular"];

/** Static mock of the student classroom, used to show what the access unlocks. */
export function ClassroomPreview({ levels }: { levels: string[] }) {
  const names = levels.length ? levels : FALLBACK_LEVELS;

  return (
    <div className="study-preview-stage">
      <div className="study-preview" data-art="study" aria-hidden>
        <div className="study-preview-top">
          <span className="study-preview-dot" />
          <span>Tu aula · La Ruta del Servidor</span>
        </div>
        <div className="study-preview-grid">
          <div className="study-preview-card study-preview-main">
            <p className="study-preview-kicker">{names[0]}</p>
            <p className="study-preview-big">
              Semana 3 <span>de 8</span>
            </p>
            <div className="study-preview-bar">
              <i style={{ width: "34%" }} />
            </div>
            <p className="study-preview-note">Próxima clase · sábado 9:00 a. m.</p>
          </div>
          <div className="study-preview-card">
            <p className="study-preview-kicker">Tus notas</p>
            {[
              ["Tarea 1", 17],
              ["Examen", 18],
              ["Participación", 19],
            ].map(([label, score]) => (
              <div key={label} className="study-preview-score">
                <span>{label}</span>
                <b>{score}</b>
              </div>
            ))}
          </div>
          <div className="study-preview-card study-preview-verse">
            <p>“Lámpara es a mis pies tu palabra, y lumbrera a mi camino.”</p>
            <span>Salmo 119:105</span>
          </div>
          <div className="study-preview-card">
            <p className="study-preview-kicker">Aviso</p>
            <p className="study-preview-notice">Este sábado traemos nuestra Biblia y un cuaderno.</p>
          </div>
        </div>
        <div className="study-preview-route">
          {names.map((name, index) => (
            <span key={name} data-on={index === 0 || undefined}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
