import { useStore } from '../store';

export function MainMenu() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const setScreen = useStore((s) => s.setScreen);

  return (
    <div className="menu">
      <div>
        <h1 className="logo">
          Grand Party
          <small>La Boca</small>
        </h1>
        <p className="tagline">
          Un tablero enorme por las calles de La Boca, dados, objetos, traiciones y minijuegos de
          Fórmula 1. En algún momento de la partida se abre el portón y se juega adentro de la cancha.
        </p>

        <div className="mode-cards">
          <button
            className={`mode-card ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => setMode('quick')}
          >
            <h3>Partida rápida</h3>
            <p>6 rondas. La Bombonera se abre cada 3 rondas. Ideal para una partida de 15 minutos.</p>
          </button>
          <button
            className={`mode-card ${mode === 'party' ? 'active' : ''}`}
            onClick={() => setMode('party')}
          >
            <h3>Modo fiesta</h3>
            <p>12 rondas, más objetos, más minijuegos y dos visitas al estadio. La experiencia completa.</p>
          </button>
        </div>

        <button className="btn primary big" onClick={() => setScreen('select')}>
          Elegir pilotos
        </button>

        <p className="legal">
          Juego original. No está afiliado ni licenciado por la Fórmula 1, la FIA, ningún equipo, piloto
          real ni por el Club Atlético Boca Juniors. Los pilotos, escuderías y el estadio son creaciones
          propias inspiradas en el automovilismo y en el barrio de La Boca.
        </p>
      </div>
    </div>
  );
}
