# ⚽ Batalla · Fútbol 5

Ranking de jugadores de fútbol 5, hosteado en GitHub Pages.

🔗 **https://mfacchina.github.io/Batalla/**

| Resultado | Puntos |
|-----------|--------|
| Ganado    | 3      |
| Empatado  | 1      |
| Perdido   | 0      |

Cada jugador suma los puntos de su equipo en cada partido que juega.

**Índice Batalla = promedio de puntos × √asistencia** (asistencia = fechas jugadas ÷ fechas totales).
Orden de la tabla: índice → partidos jugados → puntos → diferencia de gol.

**Fechas de oro:** cada `temporada.oroCada` fechas jugadas (hoy 3: la 3ª, 6ª, 9ª…) los puntos
valen doble (la DG no). Las fechas se numeran por orden de fecha entre las que tienen partido,
así que una semana sin partido no cuenta. La página anuncia la próxima arriba de la tabla.

## Arquitectura

```
data/partidos.json   ← única fuente de verdad (se edita semana a semana)
        │  fetch
        ▼
app.js               ← calcula el ranking en el navegador
        │
        ▼
index.html + styles.css  (sitio estático, sin build)
```

No hay backend ni build: cada push actualiza la página en GitHub Pages.

## Cargar un partido

Agregar un objeto al array `partidos` de `data/partidos.json`:

```json
{
  "fecha": "2026-10-23",
  "equipos": [
    { "nombre": "Equipo 1", "jugadores": ["Juan Molle", "Pal", "Bocha", "Mona", "Ferre"] },
    { "nombre": "Equipo 2", "jugadores": ["Juanse", "Pipi", "Bau", "Manuco", "Mingro"] }
  ],
  "resultado": "A",
  "diferencia": 3
}
```

- `fecha`: formato `AAAA-MM-DD`. Puede haber varios partidos en la misma fecha.
- `resultado`: `"A"` (ganó el primer equipo), `"B"` (ganó el segundo) o `"empate"`.
- `diferencia`: por cuántos goles ganó (no se registran los goles de cada equipo). En empate se omite.
  Suma a la DG de cada jugador: +N a los ganadores, −N a los perdedores.
- `nota`: opcional, texto libre.
- Los nombres tienen que coincidir con los de `jugadores` (no distingue mayúsculas/minúsculas).

- `figura`: opcional, jugador del partido (tiene que haber jugado ese partido). Suma +1 pt, sin duplicarse en fecha de oro.
- `sede`: opcional (`"KDT"`, `"Open Gallo"`), se muestra en la tarjeta del partido.

## Próximo partido

Con los equipos armados y sin resultado todavía, agregar un objeto a `proximos`:

```json
{
  "fecha": "2026-10-21",
  "hora": "19:00",
  "sede": "KDT",
  "equipos": [
    { "nombre": "Equipo 1", "jugadores": ["Bau", "Facchina", "Pipi", "Mona", "Matias Balanho"] },
    { "nombre": "Equipo 2", "jugadores": ["Pal", "Manuco", "Pitu", "Manuel Romero", "Viegas"] }
  ]
}
```

Se muestra arriba de la tabla y en Partidos, y no suma puntos. Cuando se juega, se borra de `proximos`
y se pasa a `partidos` con `resultado` y `diferencia`.

## Capitanes

Los que arman los equipos (eligen de a un jugador, alternando). Se muestran enfrentados con una
animación arriba de la tabla. `jugador` tiene que estar en `jugadores` (de ahí sale la foto);
`nombre` es el que se muestra y `remera`/`short` son colores opcionales:

```json
"capitanes": [
  { "jugador": "Bau", "nombre": "Bautista Mato", "remera": "#2f5fd0" },
  { "jugador": "Manuco", "nombre": "Manuel Mato", "remera": "#22252b" }
]
```

Sin `capitanes` (o con otra cantidad que no sea 2) no se muestra nada.

## Fecha suspendida y baja tarde (W.O.)

Agregar un objeto a `suspendidas`:

```json
{
  "fecha": "2026-10-30",
  "anotados": ["Facchina", "Pal", "Bocha", "Mona", "Ferre", "Pipi", "Bau", "Manuco", "Mingro"],
  "bajas": ["Juanse"],
  "nota": "Juanse se bajó y no consiguió reemplazo"
}
```

- `anotados`: quedan como presentes (suman asistencia, no puntos ni PJ).
- `bajas`: baja tarde sin reemplazo → pierde 3-0 (1 PJ, 0 pts, −3 DG), sin asistencia y con una amonestación 🟨.
- Las suspendidas no cuentan para numerar fechas ni para las fechas de oro.

## Fotos

Guardar la foto en `fotos/` (cuadrada, ~400 px) y mapearla en `fotos` de `data/partidos.json`:

```json
"fotos": { "Facchina": "fotos/facchina.jpg" }
```

Sin foto se muestran las iniciales. La clave tiene que ser el nombre del jugador tal cual está en `jugadores`.

Para generar la foto con fondo de cancha (recorta, quita el fondo y la pone sobre un estadio):

```bash
python3 -m venv venv && venv/bin/pip install "rembg[cpu]" pillow scipy
venv/bin/python tools/foto_cancha.py original.jpg fotos/nombre.jpg [x0 y0 x1 y1]
```

Los cuatro números opcionales son la caja de recorte (cabeza y hombros) en la foto original.
Ojo: el repo es público, así que las fotos también.

## Destacados

Rachas, logros, jugador del mes y récords se calculan solos a partir de los partidos.
El salón de la fama muestra la temporada actual al cerrarse y las anteriores cargadas en `historial`.

**Celebración de logros:** al abrir un perfil con logros que ese navegador todavía no mostró, aparece
una animación a pantalla completa (uno por uno) y los logros quedan marcados como NUEVO.
Lo ya celebrado se guarda en `localStorage` (`batalla:logros:<jugador>`), así que es por dispositivo.

## Archivos

- `calculos.js`: lógica del torneo (tabla, índice, rachas, logros, jugador del mes, récords). Sin DOM.
- `app.js`: render de la página.

## Caché

GitHub Pages cachea los archivos ~10 minutos. `data/partidos.json` se pide siempre fresco,
pero al cambiar `app.js`, `calculos.js` o `styles.css` hay que subir la versión (`?v=...`) en `index.html`.

## Ver localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

(Hace falta un servidor: abrir `index.html` directo con `file://` bloquea el `fetch` del JSON.)

## Publicar en GitHub Pages

Settings → Pages → **Build and deployment** → Source: *Deploy from a branch* →
elegir la rama y carpeta `/ (root)` → Save.
