# Grand Prix La Boca

Kart racer arcade en el navegador: 8 monoplazas corriendo por un circuito urbano de
La Boca que en el medio de la vuelta se mete adentro de La Bombonera, cruza la cancha
y sale por debajo de las tribunas. Vite + React + TypeScript + Three.js, sin assets
externos: el mundo 3D y las texturas se generan por código.

## Cómo correrlo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # typecheck + build de producción
npm run lint     # oxlint
npm run simulate # 10 carreras headless para validar el motor
```

Agregando `?auto=1` a la URL corre el modo demo: la IA maneja también el auto del
jugador, útil para mirar el circuito entero sin manejar.

## Cómo se juega

1. Elegís modo: **Copa Caminito** (3 vueltas, 8 autos), **Sprint del Puerto**
   (2 vueltas, 6 autos) o **Maratón Xeneize** (5 vueltas, grilla llena).
2. Elegís dificultad: Tranqui, Pro o Leyenda.
3. Elegís piloto: cada uno tiene velocidad, aceleración, manejo, derrape y resistencia
   distintos.
4. Corrés: derrapás para cargar mini-turbo, saltás rampas, buscás atajos y agarrás
   cajas de objetos.
5. En cada vuelta el circuito entra a La Bombonera: tribunas, reflectores, la cancha y
   los túneles de salida.

### Controles

| Acción | Teclas |
| --- | --- |
| Acelerar | W / ↑ |
| Frenar | S / ↓ |
| Girar | A D / ← → |
| Derrapar | Espacio / Shift |
| Usar objeto | E / Ctrl |

### Objetos

Turbo del Riachuelo, Escudo de Chapa, Aceite del Taller, Bengala de Tribuna, Bomba de
Barro, Pase de Atajo y Tormenta de Santa Rosa. Son originales del juego.

## Estructura

```
src/race/       motor de carrera puro (sin React ni Three.js)
  raceEngine.ts físicas arcade, derrape, objetos, IA, vueltas y ranking
  track.ts      spline del circuito, rampas, atajos, cajas y zona del estadio
  drivers.ts    roster de pilotos (data-driven)
  items.ts      objetos
src/three/      mundo 3D procedural, autos, cámara y render
src/ui/         menú, selección de piloto, HUD, minimapa
scripts/        simulación headless de carreras
```

### Rendimiento

La escena detecta si el navegador está sin aceleración por GPU y arranca en calidad
baja; además, si las vueltas de render caen por debajo de 28 fps, apaga sombras y
después baja la resolución para que la carrera siga en tiempo real.

### Agregar pilotos

Agregá una entrada en `src/race/drivers.ts`: nombre, equipo, colores, casco y stats
(`speed`, `accel`, `handling`, `drift`, `stamina`). No hace falta tocar UI ni motor.

## Legales

Los pilotos, equipos y escuderías del juego son ficticios. El proyecto no está
afiliado ni licenciado por Fórmula 1, la FIA, ningún equipo o piloto real, ni por
el Club Atlético Boca Juniors. La Boca y el estadio están representados de forma
estilizada e interpretativa. Para usar nombres, imágenes o escudos reales hacen
falta las licencias correspondientes: el roster es intercambiable justamente para
eso.
