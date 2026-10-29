'use strict';
// Render de la página. La lógica del torneo está en calculos.js.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
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
  if (j.figuras) html += ` <span class="ico" title="Jugador del partido ${j.figuras} ${j.figuras === 1 ? 'vez' : 'veces'}">🎖️${j.figuras > 1 ? `×${j.figuras}` : ''}</span>`;
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
      <ul>${e.jugadores.map((n) => `<li class="${k && clave(n) === k ? 'yo' : ''}">${esc(n.trim())}${p.figura && clave(n) === clave(p.figura) ? ' <span class="figura" title="Jugador del partido (+1 pt)">🎖️</span>' : ''}</li>`).join('')}</ul>
    </div>`;
  const esOro = oro.has(p.fecha);
  return `
    <article class="partido${esOro ? ' partido--oro' : ''}">
      <header class="partido__head">
        <span>📅 Fecha ${numeros.get(p.fecha)} · ${formatearFecha(p.fecha)}${p.sede ? ` · 📍 ${esc(p.sede)}` : ''}${esOro ? ' · <b class="oro-tag">⭐ Fecha de oro · puntos x2</b>' : ''}</span>
        ${p.figura ? `<span class="figura-tag">🎖️ Jugador del partido: <b>${esc(p.figura)}</b> · +${PUNTO_FIGURA} pt</span>` : ''}
        ${p.nota ? `<span class="nota">${esc(p.nota)}</span>` : ''}
      </header>
      <div class="partido__body">
        ${equipoHtml(a, 'A')}
        <div class="marcador">${marcador}</div>
        ${equipoHtml(b, 'B')}
      </div>
    </article>`;
}

// ---------- Capitanes ----------

const TINTA = '#1b1f2e';
const PIEL = '#f0c39d';

// Brazo en guardia: contorno + manga (o piel si es de manga corta)
const brazoPeleador = (d, color) => `
    <path d="${d}" fill="none" stroke="${TINTA}" stroke-width="30" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="22" stroke-linecap="round"/>`;

function punoPeleador([px, py]) {
  return `
    <g class="cap__puno">
      <circle cx="${px}" cy="${py}" r="17" fill="${PIEL}" stroke="${TINTA}" stroke-width="4"/>
      <path d="M${px + 2} ${py - 10} q 8 4 6 12 M${px + 4} ${py - 1} q 6 3 3 9" fill="none" stroke="${TINTA}" stroke-width="2.5" stroke-linecap="round"/>
    </g>`;
}

// Un peleador chibi mirando a la derecha, con el centro de los pies en x = 0.
// ropa "buzo": buzo, short y medias con rayas; "remera": remera y pantalón largo.
function cuerpoPeleador({ ropa = 'buzo', remera, short }) {
  const linea = `stroke="${TINTA}" stroke-width="4" stroke-linejoin="round"`;
  const zapatilla = (x, ancho) => `
    <path d="M${x} 326 q 0 -12 14 -12 h ${ancho - 26} q 14 2 14 14 v 6 h -${ancho + 2} z" fill="#f4f7f2" ${linea}/>
    <path d="M${x + 2} 330 h ${ancho - 2}" stroke="#9aa3b5" stroke-width="4"/>`;
  const piernas = ropa === 'buzo'
    ? `
      <rect x="-27" y="262" width="20" height="40" fill="${PIEL}" ${linea}/>
      <rect x="7" y="262" width="20" height="40" fill="${PIEL}" ${linea}/>
      <rect x="-29" y="290" width="24" height="28" rx="4" fill="#f4f7f2" ${linea}/>
      <rect x="5" y="290" width="24" height="28" rx="4" fill="#f4f7f2" ${linea}/>
      <path d="M-27 297 h20 M-27 304 h20 M7 297 h20 M7 304 h20" stroke="${short}" stroke-width="3"/>
      ${zapatilla(-40, 40)}${zapatilla(2, 46)}
      <path d="M-44 232 H44 L47 276 H5 L0 260 L-5 276 H-47 Z" fill="${short}" ${linea}/>
      <path d="M-38 268 H-8 M8 268 H40" stroke="#fff" stroke-width="3" opacity="0.6"/>`
    : `
      <path d="M-36 236 H-4 L-8 318 H-32 Z" fill="${short}" ${linea}/>
      <path d="M2 236 H32 L48 314 H22 Z" fill="${short}" ${linea}/>
      <path d="M-30 300 H-10 M24 296 H44" stroke="#fff" stroke-width="3" opacity="0.35"/>
      ${zapatilla(-44, 42)}${zapatilla(14, 46)}`;
  const torso = `
    <path d="M-46 154 Q -52 200 -44 246 H44 Q 52 200 46 154 Q 0 134 -46 154 Z" fill="${remera}" ${linea}/>
    ${ropa === 'buzo'
      ? `<path d="M-44 234 H44" stroke="${TINTA}" stroke-width="3" opacity="0.5"/>
         <path d="M-30 236 v8 M-15 236 v8 M0 236 v8 M15 236 v8 M30 236 v8" stroke="${TINTA}" stroke-width="2" opacity="0.35"/>
         <path d="M-16 146 Q 0 158 16 146" fill="none" stroke="${TINTA}" stroke-width="3" opacity="0.6"/>`
      : `<path d="M-14 146 Q 0 166 14 146" fill="${PIEL}" ${linea}/>
         <path d="M-30 196 q 10 6 4 20" fill="none" stroke="#fff" stroke-width="2" opacity="0.2"/>`}`;
  const conManga = ropa === 'buzo';
  return `
    <ellipse class="cap__sombra" cx="0" cy="342" rx="70" ry="9"/>
    <g class="cap__cuerpo">
      ${piernas}
      ${brazoPeleador('M-30 182 Q -26 230 14 218', conManga ? remera : PIEL)}
      ${torso}
      ${punoPeleador([18, 214])}
      ${conManga ? '' : `<circle cx="-30" cy="172" r="16" fill="${remera}" ${linea}/><circle cx="30" cy="170" r="16" fill="${remera}" ${linea}/>`}
      ${brazoPeleador('M30 172 Q 70 226 76 160', conManga ? remera : PIEL)}
      ${punoPeleador([78, 152])}
      ${conManga ? `<rect x="54" y="164" width="14" height="9" rx="2" fill="#2b2f3a" transform="rotate(-60 61 168)"/>` : ''}
    </g>`;
}

function cabezaPeleador(data, c, id) {
  // Con caricatura: cabeza grande recortada. Si no, la foto en un círculo.
  if (c.cara) {
    return `<g class="cap__cabeza"><image href="${esc(c.cara)}" x="-92" y="${-22 + (Number(c.caraY) || 0)}" width="184" height="184"/></g>`;
  }
  const foto = fotoDe(data, c.jugador);
  return `
    <g class="cap__cabeza">
      <clipPath id="${id}"><circle cx="0" cy="92" r="60"/></clipPath>
      <circle cx="0" cy="92" r="65" fill="${TINTA}"/>
      ${foto
        ? `<image href="${esc(foto)}" x="-60" y="32" width="120" height="120" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="0" cy="92" r="60" fill="#1d3b2a"/><text x="0" y="106" text-anchor="middle" class="cap__ini">${esc(iniciales(c.jugador))}</text>`}
    </g>`;
}

function renderCapitanes(data) {
  const el = $('#capitanes');
  // Un flyer ocupa este lugar y tiene prioridad sobre el dibujo de los capitanes
  const f = data.flyer;
  if (f && f.src) {
    const src = esc(f.src);
    el.innerHTML = `
      <a class="board cap cap--flyer${f.alto > f.ancho ? ' cap--vertical' : ''}" href="${src}" target="_blank" rel="noopener">
        <img src="${src}"${f.ancho ? ` width="${Number(f.ancho)}" height="${Number(f.alto)}"` : ''} alt="${esc(f.alt || '')}">
        <span class="cap__destello" aria-hidden="true"></span>
      </a>`;
    el.hidden = false;
    return;
  }
  const caps = data.capitanes || [];
  if (caps.length !== 2) return;
  const [a, b] = caps;
  const nombre = (c) => esc(c.nombre || c.jugador);
  const ropaA = { ropa: a.ropa || 'buzo', remera: a.remera || '#2f5fd0', short: a.short || '#2a52c4' };
  const ropaB = { ropa: b.ropa || 'remera', remera: b.remera || '#22252b', short: b.short || '#33373f' };
  // Rayitas de impacto alrededor de la explosión
  const rayos = [[-120, -70], [-135, 0], [-118, 66], [120, -70], [135, 0], [118, 66], [0, -112]]
    .map(([dx, dy]) => {
      const l = Math.hypot(dx, dy);
      const [ux, uy] = [dx / l, dy / l];
      return `<line x1="${320 + ux * (l - 22)}" y1="${178 + uy * (l - 22)}" x2="${320 + ux * l}" y2="${178 + uy * l}"/>`;
    }).join('');
  el.innerHTML = `
    <div class="board cap">
      <p class="cap__kicker">🥊 Capitanes · arman los equipos</p>
      <svg class="cap__ring" viewBox="0 -30 640 390" role="img" aria-label="${nombre(a)} contra ${nombre(b)}">
        <defs>
          <radialGradient id="cap-luz"><stop offset="0" stop-color="#f5c542" stop-opacity="0.28"/><stop offset="1" stop-color="#f5c542" stop-opacity="0"/></radialGradient>
        </defs>
        <ellipse cx="320" cy="190" rx="300" ry="170" fill="url(#cap-luz)"/>
        <g class="cap__explosion">
          <polygon points="320,58 342,118 398,82 374,140 440,144 384,174 432,222 368,208 372,272 330,222 302,282 290,218 232,250 258,192 202,170 262,150 226,98 288,124" fill="#d32f2f" stroke="${TINTA}" stroke-width="5" stroke-linejoin="round"/>
          <polygon points="320,96 334,136 370,116 354,152 396,158 360,176 388,206 348,196 346,234 322,202 304,238 298,198 262,212 282,178 246,164 284,152 262,118 298,134" fill="#ff5a4e"/>
          <text x="320" y="196" text-anchor="middle" class="cap__vs">VS</text>
        </g>
        <g class="cap__rayos" stroke="#f5c542" stroke-width="5" stroke-linecap="round">${rayos}</g>
        <g class="cap__peleador cap__peleador--a">
          <g transform="translate(180 0)">
            ${cuerpoPeleador(ropaA)}
            ${cabezaPeleador(data, a, 'cap-cara-a')}
          </g>
        </g>
        <g class="cap__peleador cap__peleador--b">
          <g transform="translate(460 0)">
            <g transform="scale(-1 1)">${cuerpoPeleador(ropaB)}</g>
            ${cabezaPeleador(data, b, 'cap-cara-b')}
          </g>
        </g>
      </svg>
      <div class="cap__nombres">
        <button class="cap__nombre" data-jugador="${esc(a.jugador)}">${nombre(a)}</button>
        <span class="cap__contra">🆚</span>
        <button class="cap__nombre" data-jugador="${esc(b.jugador)}">${nombre(b)}</button>
      </div>
      <p class="cap__regla">Eligen de a un jugador por vez, alternando, hasta completar los dos equipos de 5.</p>
    </div>`;
  el.hidden = false;
}

// Partidos con equipos armados que todavía no tienen resultado
const proximosDe = (data) => [...(data.proximos || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));

// Sin equipos cargados todavía: cada capitán encabeza el suyo
function equiposProximo(data, p) {
  if ((p.equipos || []).length === 2) return p.equipos;
  const caps = data.capitanes || [];
  if (caps.length !== 2) return [{ jugadores: [] }, { jugadores: [] }];
  return caps.map((c) => ({ nombre: `Equipo ${(c.nombre || c.jugador).split(' ')[0]}`, jugadores: [c.jugador], aDefinir: true }));
}

function tarjetaProximo(data, p, k) {
  const dias = diasHasta(p.fecha);
  const cuando = dias === 0 ? '¡Hoy!' : dias === 1 ? 'Mañana' : dias > 1 ? `Faltan ${dias} días` : 'Esperando resultado';
  const n = numerarFechas([...data.partidos, ...proximosDe(data)]).get(p.fecha);
  const cada = oroCadaDe(data);
  const esOro = cada && n % cada === 0;
  const [a, b] = equiposProximo(data, p);
  const equipoHtml = (e, letra) => `
    <div class="equipo">
      <h3>${esc(e.nombre || `Equipo ${letra}`)}</h3>
      <ul>${e.jugadores.map((nom) => `<li class="${k && clave(nom) === k ? 'yo' : ''}" data-jugador="${esc(nom.trim())}">${avatar(data, nom)}${esc(nom.trim())}${e.aDefinir ? ' <small class="cap-tag">capitán</small>' : ''}</li>`).join('')}</ul>
      ${e.aDefinir ? '<p class="a-definir">Elige de a uno… equipo a definir</p>' : ''}
    </div>`;
  const detalle = [
    `${DIAS[new Date(`${p.fecha}T12:00`).getDay()]} ${formatearFecha(p.fecha)}`,
    p.hora && `${esc(p.hora)} hs`,
    p.sede && `📍 ${esc(p.sede)}`,
  ].filter(Boolean).join(' · ');
  return `
    <article class="partido partido--proximo${esOro ? ' partido--oro' : ''}">
      <header class="partido__head">
        <span>⏳ Próximo partido · Fecha ${n} · ${detalle}${esOro ? ' · <b class="oro-tag">⭐ Fecha de oro · puntos x2</b>' : ''}</span>
        ${p.nota ? `<span class="nota">${esc(p.nota)}</span>` : ''}
      </header>
      <div class="partido__body">
        ${equipoHtml(a, 'A')}
        <div class="marcador"><span class="vs">VS</span><small>${cuando}</small></div>
        ${equipoHtml(b, 'B')}
      </div>
    </article>`;
}

function renderProximos(data) {
  const el = $('#proximo');
  const proximos = proximosDe(data);
  el.innerHTML = proximos.map((p) => tarjetaProximo(data, p)).join('');
  el.hidden = !proximos.length;
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
  const proximos = proximosDe(data)
    .filter((p) => !k || equiposProximo(data, p).some((e) => e.jugadores.some((n) => clave(n) === k)))
    .reverse()
    .map((p) => tarjetaProximo(data, p, k))
    .join('');

  if (!eventos.length) {
    cont.innerHTML = proximos + `<p class="vacio board">${k ? `${esc(jugador)} todavía no jugó ningún partido.` : 'Todavía no hay partidos jugados.'}</p>`;
    return;
  }
  cont.innerHTML = proximos + eventos.map((ev) => (ev.tipo === 'partido'
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
  const vistos = logrosVistos(j.nombre);
  const nuevos = vistos ? logros.filter((l) => l.logrado && !vistos.has(l.id)) : [];
  const esNuevo = new Set(nuevos.map((l) => l.id));
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
        ${j.figuras ? `<p class="perfil__mes">🎖️ Jugador del partido: ${j.figuras} ${j.figuras === 1 ? 'vez' : 'veces'}</p>` : ''}
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
        <div class="logro${l.logrado ? ' logro--ok' : ''}${esNuevo.has(l.id) ? ' logro--nuevo' : ''}" title="${esc(l.desc)}">
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

  if (nuevos.length) {
    guardarVistos(j.nombre, logros.filter((l) => l.logrado).map((l) => l.id));
    setTimeout(() => celebrar(j.nombre, nuevos), 350);
  }
}

// ---------- Celebración de logros nuevos ----------

// Cada navegador recuerda qué logros ya celebró de cada jugador.
// Si el almacenamiento no está disponible (modo privado), no se celebra para no repetirlo siempre.
const CLAVE_VISTOS = 'batalla:logros:';

function logrosVistos(nombre) {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS + clave(nombre)) || '[]'));
  } catch {
    return null;
  }
}

function guardarVistos(nombre, ids) {
  try {
    localStorage.setItem(CLAVE_VISTOS + clave(nombre), JSON.stringify(ids));
  } catch {
    // Sin almacenamiento: no pasa nada
  }
}

const COLORES_CONFETI = ['#f5c542', '#ffe08a', '#2fbf5b', '#f4f7f2', '#e0483e', '#5aa9ff'];

function lanzarConfeti(cont) {
  cont.innerHTML = '';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('i');
    c.className = 'confeti';
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = COLORES_CONFETI[i % COLORES_CONFETI.length];
    c.style.setProperty('--dur', `${2.2 + Math.random() * 2}s`);
    c.style.setProperty('--delay', `${0.2 + Math.random() * 0.8}s`);
    c.style.setProperty('--giro', `${360 + Math.random() * 720}deg`);
    c.style.setProperty('--deriva', `${(Math.random() - 0.5) * 160}px`);
    if (i % 3 === 0) c.style.borderRadius = '50%';
    cont.appendChild(c);
  }
}

function celebrar(nombre, nuevos) {
  const dlg = $('#celebracion');
  let i = 0;
  const mostrar = () => {
    const l = nuevos[i];
    $('#cel-ico').textContent = l.icono;
    $('#cel-nombre').textContent = l.nombre;
    $('#cel-desc').textContent = l.desc;
    $('#cel-jugador').textContent = nombre;
    $('#cel-contador').textContent = nuevos.length > 1 ? `${i + 1} de ${nuevos.length}` : '';
    $('#cel-btn').textContent = i < nuevos.length - 1 ? 'Siguiente logro →' : '¡Vamos! 💪';
    // Reinicia las animaciones para cada logro
    dlg.classList.remove('anim');
    void dlg.offsetWidth;
    dlg.classList.add('anim');
    lanzarConfeti($('#cel-confeti'));
    if (navigator.vibrate) navigator.vibrate([80, 60, 160]);
  };
  const avanzar = () => {
    i++;
    if (i < nuevos.length) mostrar();
    else dlg.close();
  };
  $('#cel-btn').onclick = avanzar;
  dlg.onclick = (e) => {
    if (e.target === dlg) avanzar();
  };
  dlg.onclose = () => {
    dlg.classList.remove('anim');
    $('#cel-confeti').innerHTML = '';
  };
  if (!dlg.open) dlg.showModal();
  mostrar();
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
  data.proximos = data.proximos || [];

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
  renderCapitanes(data);
  renderProximos(data);
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
