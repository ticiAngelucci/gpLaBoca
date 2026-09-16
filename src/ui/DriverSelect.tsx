import { DRIVERS } from '../engine/drivers';
import { useStore, type PlayerSetup } from '../store';

const CONTROL_LABEL: Record<PlayerSetup['control'], string> = {
  human: 'Jugador',
  cpu: 'CPU',
};

const KEY_HINTS = [
  'W A S D + Espacio',
  'Flechas + Enter',
  'I J K L + H',
  'Numpad 8 4 5 6 + 0',
];

export function DriverSelect() {
  const setup = useStore((s) => s.setup);
  const setSetup = useStore((s) => s.setSetup);
  const setScreen = useStore((s) => s.setScreen);
  const startGame = useStore((s) => s.startGame);

  const update = (i: number, patch: Partial<PlayerSetup>) => {
    const next = setup.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    setSetup(next);
  };

  const removeSeat = () => setup.length > 2 && setSetup(setup.slice(0, -1));
  const addSeat = () =>
    setup.length < 4 &&
    setSetup([
      ...setup,
      {
        name: `Jugador ${setup.length + 1}`,
        driverId: DRIVERS.find((d) => !setup.some((s) => s.driverId === d.id))?.id ?? DRIVERS[0].id,
        control: 'cpu',
      },
    ]);

  return (
    <div className="select-screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 44 }}>Elegí tu piloto</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={removeSeat} disabled={setup.length <= 2}>
            − Jugador
          </button>
          <button className="btn" onClick={addSeat} disabled={setup.length >= 4}>
            + Jugador
          </button>
          <button className="btn" onClick={() => setScreen('menu')}>
            Volver
          </button>
        </div>
      </div>

      <div className="seat-grid">
        {setup.map((seat, i) => (
          <div key={i} className="panel seat">
            <header>
              <div>
                <input
                  value={seat.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 16,
                    fontWeight: 700,
                    width: 150,
                  }}
                />
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                  {seat.control === 'human' ? KEY_HINTS[i] : 'Controlado por la máquina'}
                </div>
              </div>
              <div className="control-toggle">
                {(['human', 'cpu'] as const).map((c) => (
                  <button
                    key={c}
                    className={`chip ${seat.control === c ? 'on' : ''}`}
                    onClick={() => update(i, { control: c })}
                  >
                    {CONTROL_LABEL[c]}
                  </button>
                ))}
              </div>
            </header>

            <div className="driver-grid">
              {DRIVERS.map((d) => {
                const takenBy = setup.findIndex((s) => s.driverId === d.id);
                const taken = takenBy >= 0 && takenBy !== i;
                return (
                  <button
                    key={d.id}
                    className={`driver-card ${seat.driverId === d.id ? 'picked' : ''} ${taken ? 'taken' : ''}`}
                    disabled={taken}
                    onClick={() => update(i, { driverId: d.id })}
                  >
                    <div
                      className="helmet"
                      style={{ background: `linear-gradient(140deg, ${d.colors[0]}, ${d.colors[1]})` }}
                    />
                    {d.name}
                    <div style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 10 }}>{d.team}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              {(() => {
                const d = DRIVERS.find((x) => x.id === seat.driverId);
                if (!d) return null;
                return (
                  <>
                    <div style={{ marginBottom: 4 }}>“{d.nickname}” · {d.bio}</div>
                    <div>
                      Potencia {d.stats.power} · Suerte {d.stats.luck} · Agarre {d.stats.grip} · Reflejos{' '}
                      {d.stats.reflex}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 30 }}>
        <button className="btn primary big" onClick={startGame}>
          ¡A la pista!
        </button>
      </div>
    </div>
  );
}
