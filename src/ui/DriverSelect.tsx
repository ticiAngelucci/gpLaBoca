import { DRIVERS } from '../race/drivers';
import { ITEMS } from '../race/items';
import { useStore } from '../store';

const STAT_LABELS: [keyof (typeof DRIVERS)[0]['stats'], string][] = [
  ['speed', 'Velocidad'],
  ['accel', 'Aceleración'],
  ['handling', 'Manejo'],
  ['drift', 'Derrape'],
  ['stamina', 'Resistencia'],
];

export function DriverSelect() {
  const setup = useStore((s) => s.setup);
  const patchSetup = useStore((s) => s.patchSetup);
  const setScreen = useStore((s) => s.setScreen);
  const startRace = useStore((s) => s.startRace);
  const picked = DRIVERS.find((d) => d.id === setup.driverId) ?? DRIVERS[0];

  return (
    <div className="select-screen">
      <header className="select-head">
        <h1>Elegí tu piloto</h1>
        <div className="row">
          <span className="pill">{setup.label}</span>
          <span className="pill">{setup.laps} vueltas</span>
          <span className="pill">{setup.gridSize} autos</span>
          <button className="btn" onClick={() => setScreen('menu')}>
            Volver
          </button>
        </div>
      </header>

      <div className="driver-layout">
        <div className="driver-grid big">
          {DRIVERS.map((d) => (
            <button
              key={d.id}
              className={`driver-card ${picked.id === d.id ? 'picked' : ''}`}
              onClick={() => patchSetup({ driverId: d.id })}
            >
              <div
                className="helmet"
                style={{ background: `linear-gradient(140deg, ${d.colors[0]}, ${d.colors[1]})` }}
              />
              <strong>{d.name}</strong>
              <div className="team">{d.team}</div>
            </button>
          ))}
        </div>

        <aside className="panel driver-detail">
          <h2>{picked.name}</h2>
          <p className="nick">“{picked.nickname}” · {picked.team}</p>
          <p className="bio">{picked.bio}</p>
          <div className="stats">
            {STAT_LABELS.map(([key, label]) => (
              <div key={key} className="stat">
                <span>{label}</span>
                <div className="bar">
                  <i style={{ width: `${picked.stats[key] * 20}%`, background: picked.accent }} />
                </div>
              </div>
            ))}
          </div>

          <h3>Controles</h3>
          <ul className="controls">
            <li><b>↑ / W</b> acelerar</li>
            <li><b>↓ / S</b> frenar</li>
            <li><b>← →</b> doblar</li>
            <li><b>Espacio</b> derrapar (carga mini turbo)</li>
            <li><b>E</b> usar objeto</li>
          </ul>

          <h3>Objetos</h3>
          <ul className="items">
            {Object.values(ITEMS).map((i) => (
              <li key={i.id}>
                <span>{i.icon}</span> <b>{i.name}</b>: {i.desc}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="select-footer">
        <button className="btn primary big" onClick={startRace}>
          ¡A la pista!
        </button>
      </div>
    </div>
  );
}
