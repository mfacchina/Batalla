# ⚽ Batalla · Fútbol 5

Ranking de jugadores de fútbol 5, hosteado en GitHub Pages.

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
  "fecha": "2026-10-21",
  "nota": "Opcional, ej: Cancha 3",
  "equipos": [
    { "nombre": "Blancos", "jugadores": ["Mati", "Juan", "Pedro", "Lucas", "Nico"], "goles": 6 },
    { "nombre": "Negros",  "jugadores": ["Tomi", "Fede", "Santi", "Gonza", "Leo"],  "goles": 4 }
  ]
}
```

- `fecha`: formato `AAAA-MM-DD`. Puede haber varios partidos en la misma fecha.
- `goles`: opcional. Si no se saben los goles, omitirlos y usar `"resultado": "A"`, `"B"` o `"empate"`
  (`A` = primer equipo, `B` = segundo).
- Los nombres se comparan sin distinguir mayúsculas/minúsculas, pero conviene escribirlos siempre igual.

## Ver localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

(Hace falta un servidor: abrir `index.html` directo con `file://` bloquea el `fetch` del JSON.)

## Publicar en GitHub Pages

Settings → Pages → **Build and deployment** → Source: *Deploy from a branch* →
elegir la rama y carpeta `/ (root)` → Save.
