import { useEffect, type CSSProperties } from 'react';
import { DRIVERS } from '../race/drivers';
import { useStore } from '../store';
import { CarPreview } from './CarPreview';

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
  const currentIndex = Math.max(
    0,
    DRIVERS.findIndex((driver) => driver.id === setup.driverId),
  );
  const picked = DRIVERS[currentIndex];

  const selectAt = (index: number) => {
    const wrapped = (index + DRIVERS.length) % DRIVERS.length;
    patchSetup({ driverId: DRIVERS[wrapped].id });
  };

  useEffect(() => {
    const changeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      selectAt(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
    };
    window.addEventListener('keydown', changeWithKeyboard);
    return () => window.removeEventListener('keydown', changeWithKeyboard);
  });

  const theme = {
    '--driver-primary': picked.colors[0],
    '--driver-secondary': picked.colors[1],
    '--driver-accent': picked.accent,
  } as CSSProperties;

  return (
    <div className="select-screen carousel-screen" style={theme}>
      <header className="select-head">
        <div>
          <span className="eyebrow">Seleccioná tu máquina</span>
          <h1>Elegí piloto</h1>
        </div>
        <div className="row select-meta">
          <span className="pill">{setup.label}</span>
          <span className="pill">{setup.laps} vueltas</span>
          <span className="pill">{setup.gridSize} autos</span>
          <button className="btn" onClick={() => setScreen('menu')}>
            Volver
          </button>
        </div>
      </header>

      <main className="driver-carousel">
        <div className="car-stage">
          <button
            className="carousel-arrow previous"
            onClick={() => selectAt(currentIndex - 1)}
            aria-label="Piloto anterior"
          >
            ‹
          </button>

          <CarPreview driver={picked} />

          <button
            className="carousel-arrow next"
            onClick={() => selectAt(currentIndex + 1)}
            aria-label="Piloto siguiente"
          >
            ›
          </button>
          <span className="car-glow" aria-hidden="true" />
        </div>

        <section className="driver-identity" aria-live="polite">
          <span className="driver-number">
            {String(currentIndex + 1).padStart(2, '0')} / {String(DRIVERS.length).padStart(2, '0')}
          </span>
          <h2>{picked.name}</h2>
          <p className="driver-team">{picked.team}</p>
          <p className="driver-nickname">“{picked.nickname}”</p>
          <p className="driver-bio">{picked.bio}</p>
        </section>

        <div className="carousel-dots" aria-label="Lista de pilotos">
          {DRIVERS.map((driver, index) => (
            <button
              key={driver.id}
              className={index === currentIndex ? 'active' : ''}
              onClick={() => selectAt(index)}
              aria-label={`Elegir a ${driver.name}`}
              aria-current={index === currentIndex ? 'true' : undefined}
            />
          ))}
        </div>

        <div className="carousel-stats" aria-label="Estadísticas del piloto">
          {STAT_LABELS.map(([key, label]) => (
            <div className="carousel-stat" key={key}>
              <span>{label}</span>
              <div className="bar">
                <i style={{ width: `${picked.stats[key] * 20}%` }} />
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="select-footer carousel-footer">
        <span>Usá las flechas del teclado o de la pantalla para cambiar</span>
        <button className="btn primary big" onClick={startRace}>
          Correr con {picked.name.split(' ')[0]}
        </button>
      </footer>
    </div>
  );
}
