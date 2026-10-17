'use strict';

const PUNTOS = { G: 3, E: 1, P: 0 };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const $ = (sel) => document.querySelector(sel);

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const clave = (nombre) => nombre.trim().toLocaleLowerCase('es-AR');

function formatearFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

// Devuelve "A", "B" o "empate". Usa `resultado` si está, si no lo deduce de los goles.
function resultadoDe(partido) {
  if (partido.resultado) return partido.resultado === 'empate' ? 'empate' : partido.resultado.toUpperCase();
  const [a, b] = partido.equipos;
  if (a.goles == null || b.goles == null) throw new Error(`Partido del ${partido.fecha} sin goles ni resultado`);
  if (a.goles > b.goles) return 'A';
  if (b.goles > a.goles) return 'B';
  return 'empate';
}

const nuevoJugador = (nombre) => ({ nombre: nombre.trim(), pj: 0, pg: 0, pe: 0, pp: 0, pts: 0, dg: 0, forma: [] });

function calcularRanking(partidos, plantel = []) {
  const jugadores = new Map();
  // El plantel aparece en la tabla aunque todavía no haya jugado
  for (const nombre of plantel) jugadores.set(clave(nombre), nuevoJugador(nombre));
  const ordenados = [...partidos].sort((x, y) => x.fecha.localeCompare(y.fecha));

  for (const partido of ordenados) {
    const res = resultadoDe(partido);
    const conGoles = partido.equipos.every((e) => e.goles != null);

    partido.equipos.forEach((equipo, i) => {
      const rival = partido.equipos[1 - i];
      const letra = i === 0 ? 'A' : 'B';
      const r = res === 'empate' ? 'E' : res === letra ? 'G' : 'P';

      for (const nombre of equipo.jugadores) {
        const k = clave(nombre);
        if (!jugadores.has(k)) {
          jugadores.set(k, nuevoJugador(nombre));
        }
        const j = jugadores.get(k);
        j.pj++;
        j.pts += PUNTOS[r];
        if (r === 'G') j.pg++;
        else if (r === 'E') j.pe++;
        else j.pp++;
        if (conGoles) j.dg += equipo.goles - rival.goles;
        j.forma.push(r);
      }
    });
  }

  const lista = [...jugadores.values()].map((j) => ({ ...j, ef: j.pj ? j.pts / (j.pj * 3) : 0 }));
  const comparar = (a, b) => b.pts - a.pts || b.pg - a.pg || b.dg - a.dg || b.ef - a.ef;
  // Los que todavía no jugaron van al fondo, sin posición
  lista.sort((a, b) => (b.pj > 0) - (a.pj > 0) || comparar(a, b) || a.nombre.localeCompare(b.nombre, 'es'));

  // Posiciones compartidas cuando todos los criterios de desempate coinciden
  lista.forEach((j, i) => {
    if (!j.pj) j.pos = null;
    else j.pos = i > 0 && comparar(lista[i - 1], j) === 0 ? lista[i - 1].pos : i + 1;
  });
  return lista;
}

function renderResumen(data, ranking) {
  const partidos = data.partidos;
  const goles = partidos.reduce((t, p) => t + p.equipos.reduce((s, e) => s + (e.goles || 0), 0), 0);
  const fechas = new Set(partidos.map((p) => p.fecha)).size;
  $('#resumen').innerHTML = [
    ['Fechas', fechas],
    ['Partidos', partidos.length],
    ['Jugadores', ranking.length],
    ['Goles', goles],
  ].map(([label, valor]) => `<div class="stat"><b>${valor}</b><span>${label}</span></div>`).join('');

  if (partidos.length) {
    const ultima = partidos.map((p) => p.fecha).sort().at(-1);
    $('#actualizado').textContent = `Última fecha jugada: ${formatearFecha(ultima)}`;
  }
}

// Devuelve días que faltan para el cierre (0 = último día) o negativo si ya terminó
function diasParaCierre(fin) {
  const [a, m, d] = fin.split('-').map(Number);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(a, m - 1, d) - inicioHoy) / 86400000);
}

function renderTemporada(temporada, ranking) {
  const el = $('#temporada');
  if (!temporada || !temporada.fin) return;
  const dias = diasParaCierre(temporada.fin);
  const nombre = esc(temporada.nombre || 'Temporada');
  if (dias >= 0) {
    const quedan = dias === 0 ? '¡Último día!' : `Quedan <b>${dias}</b> ${dias === 1 ? 'día' : 'días'}`;
    el.innerHTML = `${nombre} · cierra el ${formatearFecha(temporada.fin)} · ${quedan}`;
  } else {
    const campeones = ranking.filter((j) => j.pos === 1).map((j) => esc(j.nombre));
    el.innerHTML = campeones.length
      ? `🏆 ${nombre} finalizada · ${campeones.length > 1 ? 'Campeones' : 'Campeón'}: <b>${campeones.join(', ')}</b>`
      : `${nombre} finalizada`;
    el.classList.add('temporada--fin');
  }
  el.hidden = false;
}

function renderPodio(ranking) {
  const top = ranking.filter((j) => j.pj > 0).slice(0, 3);
  if (!top.length) {
    $('#podio').innerHTML = '';
    return;
  }
  const medallas = ['🥇', '🥈', '🥉'];
  // Orden visual: 2º, 1º, 3º
  const orden = [1, 0, 2].filter((i) => top[i]);
  $('#podio').innerHTML = orden.map((i) => {
    const j = top[i];
    // Medalla y color según la posición real, así los empatados comparten podio
    const lugar = Math.min(j.pos, 3);
    return `
      <div class="podio__item podio__item--${i + 1} podio__lugar--${lugar}">
        <div class="podio__medal">${medallas[lugar - 1]}</div>
        <div class="podio__name">${esc(j.nombre)}</div>
        <div class="podio__pts">${j.pts} <small>pts</small></div>
        <div class="podio__block">${j.pos}</div>
      </div>`;
  }).join('');
}

function renderTabla(ranking, filtro = '') {
  const body = $('#tabla-body');
  if (!ranking.length) {
    body.innerHTML = `<tr><td colspan="10" class="vacio">Todavía no hay partidos cargados. ¡Que ruede la pelota! ⚽</td></tr>`;
    return;
  }
  const f = clave(filtro);
  const filas = ranking.filter((j) => !f || clave(j.nombre).includes(f));
  if (!filas.length) {
    body.innerHTML = `<tr><td colspan="10" class="vacio">Ningún jugador coincide con “${esc(filtro)}”.</td></tr>`;
    return;
  }
  body.innerHTML = filas.map((j) => `
    <tr class="fila ${j.pos <= 3 ? `top top-${j.pos}` : ''}" data-jugador="${esc(j.nombre)}" tabindex="0">
      <td class="c-pos"><span class="pos">${j.pos ?? '–'}</span></td>
      <td class="c-name">${esc(j.nombre)}</td>
      <td class="c-pts">${j.pts}</td>
      <td>${j.pj}</td>
      <td>${j.pg}</td>
      <td>${j.pe}</td>
      <td>${j.pp}</td>
      <td class="c-opt">${j.pj ? `${j.dg > 0 ? '+' : ''}${j.dg}` : '–'}</td>
      <td class="c-opt">${j.pj ? `${Math.round(j.ef * 100)}%` : '–'}</td>
      <td class="c-forma">${j.forma.slice(-5).map((r) => `<span class="badge ${r.toLowerCase()}">${r}</span>`).join('')}</td>
    </tr>`).join('');
}

function renderPartidos(partidos, jugador = null) {
  const cont = $('#lista-partidos');
  const k = jugador && clave(jugador);
  if (!partidos.length) {
    cont.innerHTML = `<p class="vacio board">Todavía no hay partidos cargados.</p>`;
    return;
  }
  const lista = [...partidos]
    .map((p, i) => ({ ...p, _i: i }))
    .filter((p) => !k || p.equipos.some((e) => e.jugadores.some((n) => clave(n) === k)))
    // Más recientes primero; dentro de la misma fecha, el último cargado primero
    .sort((x, y) => y.fecha.localeCompare(x.fecha) || y._i - x._i);

  if (!lista.length) {
    cont.innerHTML = `<p class="vacio board">${esc(jugador)} todavía no jugó ningún partido.</p>`;
    return;
  }

  cont.innerHTML = lista.map((p) => {
    const res = resultadoDe(p);
    const [a, b] = p.equipos;
    const estado = (letra) => (res === 'empate' ? 'empate' : res === letra ? 'ganador' : 'perdedor');
    const marcador = a.goles != null && b.goles != null
      ? `<span>${a.goles}</span><i>-</i><span>${b.goles}</span>`
      : `<span class="sin-goles">${res === 'empate' ? 'Empate' : 'Final'}</span>`;
    const equipoHtml = (e, letra) => `
      <div class="equipo equipo--${estado(letra)}">
        <h3>${esc(e.nombre || `Equipo ${letra}`)}${estado(letra) === 'ganador' ? ' 🏆' : ''}</h3>
        <ul>${e.jugadores.map((n) => `<li class="${k && clave(n) === k ? 'yo' : ''}">${esc(n.trim())}</li>`).join('')}</ul>
      </div>`;
    return `
      <article class="partido">
        <header class="partido__head">
          <span>📅 ${formatearFecha(p.fecha)}</span>
          ${p.nota ? `<span class="nota">${esc(p.nota)}</span>` : ''}
        </header>
        <div class="partido__body">
          ${equipoHtml(a, 'A')}
          <div class="marcador">${marcador}</div>
          ${equipoHtml(b, 'B')}
        </div>
      </article>`;
  }).join('');
}

function activarTab(nombre) {
  document.querySelectorAll('.tab').forEach((t) => {
    const activo = t.dataset.tab === nombre;
    t.classList.toggle('is-active', activo);
    t.setAttribute('aria-selected', activo);
  });
  document.querySelectorAll('.panel').forEach((p) => {
    const activo = p.id === nombre;
    p.classList.toggle('is-active', activo);
    p.hidden = !activo;
  });
}

function filtrarPartidosPor(data, jugador) {
  renderPartidos(data.partidos, jugador);
  $('#filtro').hidden = !jugador;
  $('#filtro-nombre').textContent = jugador || '';
  activarTab('partidos');
  window.scrollTo({ top: $('.tabs').offsetTop, behavior: 'smooth' });
}

async function init() {
  let data;
  try {
    // Cache-busting: GitHub Pages cachea ~10 min
    const resp = await fetch(`data/partidos.json?v=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (err) {
    $('#tabla-body').innerHTML = `<tr><td colspan="10" class="vacio">No se pudieron cargar los partidos (${esc(err.message)}).</td></tr>`;
    return;
  }

  if (data.torneo) {
    $('#titulo').textContent = data.torneo;
    document.title = data.torneo;
  }

  const ranking = calcularRanking(data.partidos, data.jugadores);
  renderResumen(data, ranking);
  renderTemporada(data.temporada, ranking);
  renderPodio(ranking);
  renderTabla(ranking);
  renderPartidos(data.partidos);

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => activarTab(t.dataset.tab)));
  $('#buscar').addEventListener('input', (e) => renderTabla(ranking, e.target.value));
  $('#filtro-quitar').addEventListener('click', () => filtrarPartidosPor(data, null));

  const abrirJugador = (e) => {
    const fila = e.target.closest('tr[data-jugador]');
    if (fila) filtrarPartidosPor(data, fila.dataset.jugador);
  };
  $('#tabla-body').addEventListener('click', abrirJugador);
  $('#tabla-body').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') abrirJugador(e);
  });
}

init();
