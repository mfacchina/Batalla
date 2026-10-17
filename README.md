# ⚽ Batalla · Fútbol 5

Ranking de jugadores de fútbol 5, hosteado en GitHub Pages.

🔗 **https://mfacchina.github.io/Batalla/**

| Resultado | Puntos |
|-----------|--------|
| Ganado    | 3      |
| Empatado  | 1      |
| Perdido   | 0      |

Cada jugador suma los puntos de su equipo en cada partido que juega.
Desempate: puntos → partidos ganados → diferencia de gol → efectividad.

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

## Ver localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

(Hace falta un servidor: abrir `index.html` directo con `file://` bloquea el `fetch` del JSON.)

## Publicar en GitHub Pages

Settings → Pages → **Build and deployment** → Source: *Deploy from a branch* →
elegir la rama y carpeta `/ (root)` → Save.
