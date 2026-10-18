'use strict';
// Render de la página. La lógica del torneo está en calculos.js.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const $ = (sel) => document.querySelector(sel);

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const fmt = (n, dec = 2) => n.toFixed(dec).replace('.', ',');
const lista = (nombres) => nombres.map(esc).join(', ');

function formatearFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

const nombreMes = (mes) => `${MESES_LARGOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

// ---------- Fotos ----------

function fotoDe(data, nombre) {
  const fotos = data.fotos || {};
  const k = Object.keys(fotos).find((n) => clave(n) === clave(nombre));
  return k ? fotos[k] : null;
}

function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function avatar(data, nombre, tam = 'sm') {
  const foto = fotoDe(data, nombre);
  return foto
    ? `<img class="avatar avatar--${tam}" src="${esc(foto)}" alt="" loading="lazy">`
    : `<span class="avatar avatar--${tam} avatar--ini" aria-hidden="true">${esc(iniciales(nombre))}</span>`;
}

// ---------- Encabezado ----------

function renderResumen(data, tabla) {
  const partidos = data.partidos;
  $('#resumen').innerHTML = [
    ['Fechas', numerarFechas(partidos).size],
    ['Partidos', partidos.length],
    ['Jugadores', tabla.jugadores.length],
  ].map(([label, valor]) => `<div class="stat"><b>${valor}</b><span>${label}</span></div>`).join('');

  const fechas = eventosDe(data).map((e) => e.fecha);
  if (fechas.length) $('#actualizado').textContent = `Última fecha: ${formatearFecha(fechas.at(-1))}`;
}

function renderTemporada(data, tabla) {
  const temporada = data.temporada;
  const el = $('#temporada');
  if (!temporada || !temporada.fin) return;
  const dias = diasHasta(temporada.fin);
  const nombre = esc(temporada.nombre || 'Temporada');
  if (dias >= 0) {
    const quedan = dias === 0 ? '¡Último día!' : `Quedan <b>${dias}</b> ${dias === 1 ? 'día' : 'días'}`;
    el.innerHTML = `${nombre} · cierra el ${formatearFecha(temporada.fin)} · ${quedan}`;
  } else {
    const campeones = tabla.jugadores.filter((j) => j.pos === 1).map((j) => j.nombre);
    el.innerHTML = campeones.length
      ? `🏆 ${nombre} finalizada · ${campeones.length > 1 ? 'Campeones' : 'Campeón'}: <b>${lista(campeones)}</b>`
      : `${nombre} finalizada`;
    el.classList.add('temporada--fin');
  }
  el.hidden = false;
}

function renderProximaOro(data) {
  const cada = oroCadaDe(data);
  if (!cada || temporadaTerminada(data)) return;
  const jugadas = numerarFechas(data.partidos).size;
  const proxima = (Math.floor(jugadas / cada) + 1) * cada;
  const faltan = proxima - jugadas;
  const el = $('#prox-oro');
  el.innerHTML = faltan === 1
    ? `⭐ <b>¡La próxima es fecha de oro!</b> (Fecha ${proxima}) · puntos x2`
    : `⭐ Próxima fecha de oro: <b>Fecha ${proxima}</b> · faltan ${faltan} fechas`;
  el.hidden = false;
}

// ---------- Ranking ----------

const badgeForma = ({ r, oro, wo }) => (wo
  ? '<span class="badge p wo" title="Perdió por W.O.">W</span>'
  : `<span class="badge ${r.toLowerCase()}${oro ? ' oro' : ''}"${oro ? ' title="Fecha de oro"' : ''}>${r}</span>`);

function iconosJugador(j) {
  let html = '';
  if (j.racha >= 3) html += ` <span class="ico" title="${j.racha} partidos seguidos sin perder">🔥${j.racha}</span>`;
  if (j.wo) html += ` <span class="ico" title="${j.wo} ${j.wo === 1 ? 'amonestación' : 'amonestaciones'}">🟨${j.wo > 1 ? `×${j.wo}` : ''}</span>`;
  return html;
}

function renderPodio(data, tabla) {
  const top = tabla.jugadores.filter((j) => j.pj > 0).slice(0, 3);
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
      <button class="podio__item podio__item--${i + 1} podio__lugar--${lugar}" data-jugador="${esc(j.nombre)}">
        <div class="podio__medal">${medallas[lugar - 1]}</div>
        ${avatar(data, j.nombre, 'md')}
        <div class="podio__name">${esc(j.nombre)}</div>
        <div class="podio__pts">${fmt(j.indice)} <small>índice</small></div>
        <div class="podio__sub">${j.pts} pts · ${j.pj} PJ</div>
        <div class="podio__block">${j.pos}</div>
      </button>`;
  }).join('');
}

function renderTabla(data, tabla, filtro = '') {
  const body = $('#tabla-body');
  if (!tabla.jugadores.length) {
    body.innerHTML = '<tr><td colspan="12" class="vacio">Todavía no hay partidos cargados. ¡Que ruede la pelota! ⚽</td></tr>';
    return;
  }
  const f = clave(filtro);
  const filas = tabla.jugadores.filter((j) => !f || clave(j.nombre).includes(f));
  if (!filas.length) {
    body.innerHTML = `<tr><td colspan="12" class="vacio">Ningún jugador coincide con “${esc(filtro)}”.</td></tr>`;
    return;
  }
  body.innerHTML = filas.map((j) => `
    <tr class="fila ${j.pos <= 3 ? `top top-${j.pos}` : ''}" data-jugador="${esc(j.nombre)}" tabindex="0">
      <td class="c-pos"><span class="pos">${j.pos ?? '–'}</span></td>
      <td class="c-name"><span class="solo-desk">${avatar(data, j.nombre)}</span>${esc(j.nombre)}${iconosJugador(j)}</td>
      <td class="c-ind">${j.pj ? fmt(j.indice) : '–'}</td>
      <td>${j.pts}</td>
      <td>${j.pj}</td>
      <td class="c-opt">${j.pg}</td>
      <td class="c-opt">${j.pe}</td>
      <td class="c-opt">${j.pp}</td>
      <td class="c-opt">${j.pj ? `${j.dg > 0 ? '+' : ''}${j.dg}` : '–'}</td>
      <td class="c-opt">${j.pj ? fmt(j.prom) : '–'}</td>
      <td class="c-opt">${tabla.totalFechas ? `${Math.round(j.asist * 100)}%` : '–'}</td>
      <td class="c-forma">${j.forma.slice(-5).map(badgeForma).join('')}</td>
    </tr>`).join('');
}

// ---------- Partidos ----------

function tarjetaPartido(p, numeros, oro, k) {
  const res = resultadoDe(p);
  const [a, b] = p.equipos;
  const estado = (letra) => (res === 'empate' ? 'empate' : res === letra ? 'ganador' : 'perdedor');
  const dif = diferenciaDe(p);
  const marcador = res === 'empate'
    ? '<span class="sin-goles">Empate</span>'
    : `<span>+${dif}</span><small>Ganó ${esc((res === 'A' ? a : b).nombre || `Equipo ${res}`)}</small>`;
  const equipoHtml = (e, letra) => `
    <div class="equipo equipo--${estado(letra)}">
      <h3>${esc(e.nombre || `Equipo ${letra}`)}${estado(letra) === 'ganador' ? ' 🏆' : ''}</h3>
      <ul>${e.jugadores.map((n) => `<li class="${k && clave(n) === k ? 'yo' : ''}">${esc(n.trim())}</li>`).join('')}</ul>
    </div>`;
  const esOro = oro.has(p.fecha);
  return `
    <article class="partido${esOro ? ' partido--oro' : ''}">
      <header class="partido__head">
        <span>📅 Fecha ${numeros.get(p.fecha)} · ${formatearFecha(p.fecha)}${esOro ? ' · <b class="oro-tag">⭐ Fecha de oro · puntos x2</b>' : ''}</span>
        ${p.nota ? `<span class="nota">${esc(p.nota)}</span>` : ''}
      </header>
      <div class="partido__body">
        ${equipoHtml(a, 'A')}
        <div class="marcador">${marcador}</div>
        ${equipoHtml(b, 'B')}
      </div>
    </article>`;
}

function tarjetaSuspendida(s, k) {
  const bajas = new Set((s.bajas || []).map(clave));
  const anotados = (s.anotados || []).filter((n) => !bajas.has(clave(n)));
  const nombreHtml = (n) => `<li class="${k && clave(n) === k ? 'yo' : ''}">${esc(n.trim())}</li>`;
  return `
    <article class="partido partido--suspendida">
      <header class="partido__head">
        <span>🚫 Fecha suspendida · ${formatearFecha(s.fecha)}</span>
        ${s.nota ? `<span class="nota">${esc(s.nota)}</span>` : ''}
      </header>
      <div class="suspendida__body">
        <div>
          <h3>🙋 Presentes (${anotados.length})</h3>
          <p class="suspendida__nota">Se anotaron: suman asistencia, sin puntos.</p>
          <ul>${anotados.map(nombreHtml).join('')}</ul>
        </div>
        ${(s.bajas || []).length ? `
        <div>
          <h3>🟨 Baja tarde · W.O.</h3>
          <p class="suspendida__nota">Pierde 3-0 y recibe una amonestación.</p>
          <ul>${s.bajas.map(nombreHtml).join('')}</ul>
        </div>` : ''}
      </div>
    </article>`;
}

function renderPartidos(data, jugador = null) {
  const cont = $('#lista-partidos');
  const k = jugador && clave(jugador);
  const numeros = numerarFechas(data.partidos);
  const oro = fechasDeOroDe(data);
  const participa = (ev) => (ev.tipo === 'partido'
    ? ev.p.equipos.some((e) => e.jugadores.some((n) => clave(n) === k))
    : [...(ev.s.anotados || []), ...(ev.s.bajas || [])].some((n) => clave(n) === k));
  // Más recientes primero
  const eventos = eventosDe(data).filter((ev) => !k || participa(ev)).reverse();

  if (!eventos.length) {
    cont.innerHTML = `<p class="vacio board">${k ? `${esc(jugador)} todavía no jugó ningún partido.` : 'Todavía no hay partidos cargados.'}</p>`;
    return;
  }
  cont.innerHTML = eventos.map((ev) => (ev.tipo === 'partido'
    ? tarjetaPartido(ev.p, numeros, oro, k)
    : tarjetaSuspendida(ev.s, k))).join('');
}

// ---------- Destacados ----------

function renderDelMes(meses) {
  const el = $('#del-mes');
  if (!meses.length) {
    el.innerHTML = '<p class="vacio">Todavía no hay fechas jugadas.</p>';
    return;
  }
  el.innerHTML = [...meses].reverse().map((m) => {
    const top = m.tabla.jugadores.filter((j) => j.pj > 0).slice(0, 3);
    const nombres = m.ganadores.length > 3
      ? `${m.ganadores.length} empatados`
      : lista(m.ganadores.map((g) => g.nombre));
    const titulo = m.cerrado
      ? (m.ganadores.length ? `🏅 <b>${nombres}</b>` : 'Sin ganador')
      : (m.ganadores.length ? `En curso · va ganando <b>${nombres}</b>` : 'En curso');
    return `
      <div class="mes${m.cerrado ? '' : ' mes--curso'}">
        <div class="mes__head"><h3>${nombreMes(m.mes)}</h3><span>${titulo}</span></div>
        <ol class="mes__top">${top.map((j) => `<li><span>${j.pos}º</span> ${esc(j.nombre)} <small>${fmt(j.indice)} · ${j.pj} PJ</small></li>`).join('')}</ol>
      </div>`;
  }).join('');
}

function renderRecords(data, tabla) {
  const rec = records(data, tabla);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const tarjeta = (icono, titulo, r, valor, extra = '') => `
    <div class="record">
      <div class="record__ico">${icono}</div>
      <div class="record__body">
        <h3>${titulo}</h3>
        ${r ? `<p class="record__valor">${valor}</p><p>${lista(r.nombres)}${extra}</p>` : '<p class="record__vacio">Todavía nadie</p>'}
      </div>
    </div>`;
  $('#records').innerHTML = [
    tarjeta('🔥', 'Mejor racha invicta', rec.mejorRacha, rec.mejorRacha && plural(rec.mejorRacha.valor, 'partido', 'partidos')),
    tarjeta('⚡', 'Racha en curso', rec.rachaActual, rec.rachaActual && `${plural(rec.rachaActual.valor, 'partido', 'partidos')} sin perder`),
    tarjeta('🏆', 'Más victorias', rec.victorias, rec.victorias && plural(rec.victorias.valor, 'victoria', 'victorias')),
    tarjeta('💥', 'Mayor goleada', rec.goleada, rec.goleada && `+${rec.goleada.valor}`,
      rec.goleada ? ` <small>(Fecha ${rec.goleada.numero} · ${formatearFecha(rec.goleada.fecha)})</small>` : ''),
    tarjeta('🙋', 'Más presente', rec.presente, rec.presente && plural(rec.presente.valor, 'fecha', 'fechas')),
  ].join('');
}

function renderSalon(data, tabla, meses) {
  const entradas = salonDeLaFama(data, tabla, meses);
  const el = $('#salon');
  if (!entradas.length) {
    const fin = data.temporada && data.temporada.fin;
    el.innerHTML = `<p class="vacio">Al cierre de la temporada${fin ? ` (${formatearFecha(fin)})` : ''} acá quedan grabados el campeón, el podio, la mejor racha, el más presente y los jugadores del mes.</p>`;
    return;
  }
  const fila = (ico, titulo, nombres, extra = '') => (nombres && nombres.length
    ? `<li><span>${ico} ${titulo}</span><b>${lista(nombres)}</b>${extra}</li>` : '');
  el.innerHTML = entradas.map((t) => `
    <div class="salon">
      <h3>${esc(t.temporada)}</h3>
      <ul>
        ${fila('🥇', 'Campeón', t.campeon)}
        ${fila('🥈', 'Segundo', t.segundo)}
        ${fila('🥉', 'Tercero', t.tercero)}
        ${t.mejorRacha ? fila('🔥', 'Mejor racha', t.mejorRacha.nombres, ` <small>${t.mejorRacha.valor} sin perder</small>`) : ''}
        ${t.masPresente ? fila('🙋', 'Más presente', t.masPresente.nombres, ` <small>${t.masPresente.valor} fechas</small>`) : ''}
        ${(t.jugadoresDelMes || []).map((m) => fila('📅', nombreMes(m.mes), m.nombres)).join('')}
      </ul>
    </div>`).join('');
}

// ---------- Perfil ----------

function abrirPerfil(estado, nombre) {
  const { data, tabla, meses } = estado;
  const j = buscarJugador(tabla, nombre);
  if (!j) return;
  const logros = logrosDe(j, contextoLogros(data, tabla, meses));
  const { dupla, bestia } = cruces(j);
  const evo = evolucion(data, j.nombre).filter((e) => e.pos);
  const ultimos = [...j.forma].reverse().slice(0, 5);
  const delMes = meses.filter((m) => m.cerrado && m.ganadores.some((g) => clave(g.nombre) === clave(j.nombre)));
  const recCruce = (c) => `${c.pj} PJ · ${c.g}G ${c.e}E ${c.p}P`;
  const tile = (valor, label) => `<div class="tile"><b>${valor}</b><span>${label}</span></div>`;

  $('#perfil-contenido').innerHTML = `
    <div class="perfil__head">
      ${avatar(data, j.nombre, 'lg')}
      <div>
        <h2>${esc(j.nombre)}</h2>
        <p>${j.pos ? `<b>${j.pos}º</b> en la tabla · Índice <b>${fmt(j.indice)}</b>` : 'Todavía no jugó'}</p>
        ${j.wo ? `<p class="perfil__tarjetas">🟨 ${j.wo} ${j.wo === 1 ? 'amonestación' : 'amonestaciones'} (baja tarde)</p>` : ''}
        ${delMes.length ? `<p class="perfil__mes">📅 Jugador del mes: ${delMes.map((m) => nombreMes(m.mes)).join(', ')}</p>` : ''}
      </div>
    </div>
    <div class="perfil__stats">
      ${tile(j.pj ? fmt(j.indice) : '–', 'Índice')}
      ${tile(j.pts, 'Puntos')}
      ${tile(j.pj, 'PJ')}
      ${tile(`${j.pg}-${j.pe}-${j.pp}`, 'G-E-P')}
      ${tile(j.pj ? `${j.dg > 0 ? '+' : ''}${j.dg}` : '–', 'DG')}
      ${tile(j.pj ? fmt(j.prom) : '–', 'Promedio')}
      ${tile(tabla.totalFechas ? `${Math.round(j.asist * 100)}%` : '–', 'Asistencia')}
      ${tile(j.mejorRacha, 'Mejor racha')}
    </div>
    ${j.racha >= 2 ? `<p class="perfil__racha">🔥 Racha actual: <b>${j.racha}</b> partidos sin perder</p>` : ''}

    <h3>🏅 Logros <small>${logros.filter((l) => l.logrado).length}/${logros.length}</small></h3>
    <div class="logros">
      ${logros.map((l) => `
        <div class="logro${l.logrado ? ' logro--ok' : ''}" title="${esc(l.desc)}">
          <span class="logro__ico">${l.icono}</span>
          <span class="logro__txt"><b>${esc(l.nombre)}</b><small>${esc(l.desc)}</small></span>
        </div>`).join('')}
    </div>

    <h3>🤝 Compañeros y rivales</h3>
    <div class="cruces">
      <div class="cruce"><span>Mejor dupla</span>${dupla ? `<b>${esc(dupla[0])}</b><small>${recCruce(dupla[1])}</small>` : '<small>Se define con 2 partidos juntos</small>'}</div>
      <div class="cruce"><span>Bestia negra</span>${bestia ? `<b>${esc(bestia[0])}</b><small>${recCruce(bestia[1])}</small>` : '<small>Se define con 2 partidos en contra</small>'}</div>
    </div>

    ${evo.length ? `
    <h3>📈 Evolución en la tabla</h3>
    <div class="evo">${evo.map((e) => `<span title="${formatearFecha(e.fecha)}"><small>${formatearFecha(e.fecha).replace(/ \d{4}$/, '')}</small><b>${e.pos}º</b></span>`).join('')}</div>` : ''}

    ${ultimos.length ? `
    <h3>📋 Últimos partidos</h3>
    <ul class="ultimos">${ultimos.map((f) => `<li>${badgeForma(f)} <span>${formatearFecha(f.fecha)}</span>${f.wo ? ' <small>W.O. (baja tarde)</small>' : f.oro ? ' <small>⭐ fecha de oro</small>' : ''}</li>`).join('')}</ul>` : ''}
    <button class="chip perfil__ver" data-ver-partidos="${esc(j.nombre)}">Ver todos sus partidos →</button>`;

  const dlg = $('#perfil');
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  history.replaceState(null, '', `#jugador=${encodeURIComponent(j.nombre)}`);
}

function cerrarPerfil() {
  const dlg = $('#perfil');
  if (dlg.open) dlg.close();
}

// ---------- Reglamento ----------

function renderReglamento(data) {
  document.querySelectorAll('.js-oro-cada').forEach((e) => { e.textContent = oroCadaDe(data) || '–'; });
  $('#lista-logros').innerHTML = LOGROS.map((l) => `<li><span>${l.icono}</span> <b>${esc(l.nombre)}:</b> ${esc(l.desc)}</li>`).join('');
}

// ---------- Navegación ----------

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
  renderPartidos(data, jugador);
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
    $('#tabla-body').innerHTML = `<tr><td colspan="12" class="vacio">No se pudieron cargar los partidos (${esc(err.message)}).</td></tr>`;
    return;
  }
  data.partidos = data.partidos || [];

  if (data.torneo) {
    $('#titulo').textContent = data.torneo;
    document.title = data.torneo;
  }

  const tabla = calcularTabla(data);
  const meses = jugadoresDelMes(data);
  const estado = { data, tabla, meses };

  renderResumen(data, tabla);
  renderTemporada(data, tabla);
  renderProximaOro(data);
  renderTabla(data, tabla);
  renderPodio(data, tabla);
  renderPartidos(data);
  renderDelMes(meses);
  renderRecords(data, tabla);
  renderSalon(data, tabla, meses);
  renderReglamento(data);

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => activarTab(t.dataset.tab)));
  $('#buscar').addEventListener('input', (e) => renderTabla(data, tabla, e.target.value));
  $('#filtro-quitar').addEventListener('click', () => filtrarPartidosPor(data, null));

  // Cualquier elemento con data-jugador abre el perfil
  const abrirDesde = (e) => {
    const el = e.target.closest('[data-jugador]');
    if (el) abrirPerfil(estado, el.dataset.jugador);
  };
  document.addEventListener('click', (e) => {
    const ver = e.target.closest('[data-ver-partidos]');
    if (ver) {
      cerrarPerfil();
      filtrarPartidosPor(data, ver.dataset.verPartidos);
      return;
    }
    abrirDesde(e);
  });
  $('#tabla-body').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') abrirDesde(e);
  });

  const dlg = $('#perfil');
  $('#perfil-cerrar').addEventListener('click', cerrarPerfil);
  // Click en el fondo cierra
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) cerrarPerfil();
  });
  dlg.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));

  // Link directo a un perfil: #jugador=Nombre
  const m = location.hash.match(/^#jugador=(.+)$/);
  if (m) abrirPerfil(estado, decodeURIComponent(m[1]));
}

init();
