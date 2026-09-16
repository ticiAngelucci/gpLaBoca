# Grand Party La Boca

Juego de tablero + minijuegos para 2 a 4 jugadores, ambientado en La Boca, con autos
de monoplaza y La Bombonera como escenario central. Corre en el navegador
(Vite + React + TypeScript + Three.js), sin assets externos: todo el mundo 3D y las
texturas se generan por código.

## Cómo correrlo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # typecheck + build de producción
npm run lint     # oxlint
npm run simulate # 24 partidas headless para validar el motor de turnos
```

## Cómo se juega

1. Elegís modo: **Partida rápida** (6 rondas) o **Modo fiesta** (12 rondas).
2. Elegís 2 a 4 pilotos y marcás cuáles son humanos y cuáles CPU.
3. Cada turno se tira el dado, el auto recorre el tablero y se resuelve la casilla.
4. Las monedas compran la estrella (20 monedas) que aparece rotando por el barrio.
5. Al final de cada ronda se juega un minijuego y se reparten monedas por puesto.
6. En determinada ronda **se abre el portón de La Bombonera**: todos bajan por el
   túnel, dan una vuelta por la cancha, juegan un minijuego adentro y salen otra vez
   a las calles.
7. Gana quien más estrellas tenga; las monedas desempatan y hay estrellas bonus por
   monedas y por minijuegos ganados.

### Controles (multijugador local, un teclado)

| Jugador | Mover | Acción |
| --- | --- | --- |
| P1 | W A S D | Espacio / F |
| P2 | Flechas | Enter / Shift der. |
| P3 | I J K L | H |
| P4 | Numpad 8 4 5 6 | Numpad 0 |

## Estructura

```
src/engine/     motor de juego puro (sin React ni Three.js)
  types.ts      tipos de estado y acciones
  engine.ts     máquina de estados: reduce(state, action)
  board.ts      grafo del tablero de La Boca + Bombonera
  rng.ts        PRNG determinista por semilla
  drivers.ts    roster de pilotos (data-driven)
  items.ts      objetos
src/three/      mundo 3D procedural (calles, casas, estadio, autos)
src/minigames/  framework + minijuegos independientes
src/ui/         menús, HUD, vistas de tablero y minijuego
scripts/        simulación headless del motor
```

### Multijugador online a futuro

El motor es una función pura `reduce(state, action)` con RNG determinista
(`seed` + `rngCursor` viven en el estado). Un servidor solo necesita ordenar las
acciones y difundirlas: cada cliente llega al mismo estado sin enviar el estado
completo. La UI nunca muta el estado por su cuenta: solo despacha acciones.

### Agregar pilotos

Agregá una entrada en `src/engine/drivers.ts`. Nombre, equipo, colores, stats
(`power`, `luck`, `grip`, `reflex`) y casco. No hace falta tocar UI ni motor: la
selección de pilotos, los colores del auto y las stats se leen de ahí.

## Legales

Los pilotos, equipos y escuderías del juego son ficticios. El proyecto no está
afiliado ni licenciado por Fórmula 1, la FIA, ningún equipo o piloto real, ni por
el Club Atlético Boca Juniors. La Boca y el estadio están representados de forma
estilizada e interpretativa. Para usar nombres, imágenes o escudos reales hacen
falta las licencias correspondientes: el roster es intercambiable justamente para
eso.
