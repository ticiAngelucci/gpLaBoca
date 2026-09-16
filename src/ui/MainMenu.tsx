import { useStore, type Difficulty } from '../store';

const MODES: { label: string; laps: number; grid: number; desc: string }[] = [
  {
    label: 'Copa Caminito',
    laps: 3,
    grid: 8,
    desc: '3 vueltas, 8 autos. La carrera completa con la pasada por la cancha.',
  },
  {
    label: 'Sprint del Puerto',
    laps: 2,
    grid: 6,
    desc: '2 vueltas, 6 autos. Corta, sucia y a los codazos.',
  },
  {
    label: 'Maratón Xeneize',
    laps: 5,
    grid: 8,
    desc: '5 vueltas, grilla llena. Para los que quieren pelearla hasta el final.',
  },
];

const DIFFS: { id: Difficulty; label: string; desc: string }[] = [
  { id: 'tranqui', label: 'Tranqui', desc: 'Los rivales te esperan.' },
  { id: 'pro', label: 'Pro', desc: 'Corren parejo con vos.' },
  { id: 'leyenda', label: 'Leyenda', desc: 'No perdonan un error.' },
];

export function MainMenu() {
  const setup = useStore((s) => s.setup);
  const patchSetup = useStore((s) => s.patchSetup);
  const setScreen = useStore((s) => s.setScreen);

  return (
    <div className="menu">
      <div>
        <h1 className="logo">
          Grand Prix
          <small>La Boca</small>
        </h1>
        <p className="tagline">
          Carreras arcade por Caminito, el puerto y los adoquines del barrio. Derrapá, saltá rampas,
          usá objetos y en el medio de la vuelta metete adentro de la cancha.
        </p>

        <div className="mode-cards">
          {MODES.map((m) => (
            <button
              key={m.label}
              className={`mode-card ${setup.label === m.label ? 'active' : ''}`}
              onClick={() => patchSetup({ label: m.label, laps: m.laps, gridSize: m.grid })}
            >
              <h3>{m.label}</h3>
              <p>{m.desc}</p>
            </button>
          ))}
        </div>

        <div className="diff-row">
          {DIFFS.map((d) => (
            <button
              key={d.id}
              className={`chip big ${setup.difficulty === d.id ? 'on' : ''}`}
              onClick={() => patchSetup({ difficulty: d.id })}
              title={d.desc}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button className="btn primary big" onClick={() => setScreen('select')}>
          Elegir piloto
        </button>

        <p className="legal">
          Juego original. No está afiliado ni licenciado por la Fórmula 1, la FIA, ningún equipo,
          piloto real ni por el Club Atlético Boca Juniors. Los pilotos, escuderías, el circuito y el
          estadio son creaciones propias inspiradas en el automovilismo y en el barrio de La Boca.
        </p>
      </div>
    </div>
  );
}
