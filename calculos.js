'use strict';
// Cálculos del torneo, sin DOM. Se carga antes que app.js.

const PUNTOS = { G: 3, E: 1, P: 0 };
// Baja tarde sin reemplazo: cuenta como partido perdido 3-0
const WO_DIFERENCIA = 3;
// Jugador del partido: punto extra (no se duplica en fecha de oro)
const PUNTO_FIGURA = 1;

const clave = (nombre) => nombre.trim().toLocaleLowerCase('es-AR');

const isoHoy = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};

// Días que faltan hasta `fecha` (0 = hoy, negativo = ya pasó)
function diasHasta(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(a, m - 1, d) - inicioHoy) / 86400000);
}

const temporadaTerminada = (data) => Boolean(data.temporada && data.temporada.fin && diasHasta(data.temporada.fin) < 0);

// Devuelve "A", "B" o "empate"
function resultadoDe(partido) {
  const r = String(partido.resultado || '').trim().toLowerCase();
  if (r === 'empate') return 'empate';
  if (r === 'a' || r === 'b') return r.toUpperCase();
  throw new Error(`Partido del ${partido.fecha} sin resultado válido`);
}

// Diferencia de gol del partido (0 en empate)
const diferenciaDe = (partido) => (resultadoDe(partido) === 'empate' ? 0 : Math.abs(Number(partido.diferencia) || 0));

const suspendidasDe = (data) => data.suspendidas || [];

// Número de fecha (1, 2, 3…) según el orden de las fechas jugadas. Las suspendidas no cuentan.
function numerarFechas(partidos) {
  const fechas = [...new Set(partidos.map((p) => p.fecha))].sort();
  return new Map(fechas.map((f, i) => [f, i + 1]));
}

// Fecha de oro: cada `oroCada` fechas jugadas, los puntos valen doble
const oroCadaDe = (data) => Number(data.temporada && data.temporada.oroCada) || 0;

function fechasDeOroDe(data) {
  const cada = oroCadaDe(data);
  const oro = new Set();
  if (!cada) return oro;
  for (const [fecha, n] of numerarFechas(data.partidos)) if (n % cada === 0) oro.add(fecha);
  return oro;
}

// Partidos y fechas suspendidas ordenados por fecha, opcionalmente dentro de [desde, hasta]
function eventosDe(data, { desde = '', hasta = '9999-12-31' } = {}) {
  const eventos = [
    ...data.partidos.map((p, i) => ({ tipo: 'partido', fecha: p.fecha, p, i })),
    ...suspendidasDe(data).map((s, i) => ({ tipo: 'suspendida', fecha: s.fecha, s, i })),
  ].filter((e) => e.fecha >= desde && e.fecha <= hasta);
  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha)
    || (a.tipo === b.tipo ? a.i - b.i : a.tipo === 'partido' ? -1 : 1));
}

const nuevoJugador = (nombre) => ({
  nombre: nombre.trim(),
  pj: 0, pg: 0, pe: 0, pp: 0, pts: 0, dg: 0, wo: 0, figuras: 0,
  forma: [], presentes: new Set(),
  racha: 0, mejorRacha: 0, rachaG: 0, mejorRachaG: 0,
  oroGanadas: 0, mayorGoleada: 0,
  companeros: new Map(), rivales: new Map(),
});

function registrar(j, r, { fecha, oro = false, dif = 0, wo = false }) {
  j.pj++;
  j.pts += PUNTOS[r] * (oro ? 2 : 1);
  if (r === 'G') j.pg++;
  else if (r === 'E') j.pe++;
  else j.pp++;
  j.dg += r === 'G' ? dif : r === 'P' ? -dif : 0;
  j.forma.push({ r, oro, wo, fecha });
  // Racha = partidos seguidos sin perder; rachaG = victorias seguidas
  j.racha = r === 'P' ? 0 : j.racha + 1;
  j.rachaG = r === 'G' ? j.rachaG + 1 : 0;
  j.mejorRacha = Math.max(j.mejorRacha, j.racha);
  j.mejorRachaG = Math.max(j.mejorRachaG, j.rachaG);
  if (r === 'G' && oro) j.oroGanadas++;
  if (r === 'G') j.mayorGoleada = Math.max(j.mayorGoleada, dif);
}

function sumarCruce(mapa, nombre, r) {
  const c = mapa.get(nombre) || { pj: 0, g: 0, e: 0, p: 0 };
  c.pj++;
  c[r.toLowerCase()]++;
  mapa.set(nombre, c);
}

// Tabla de posiciones (toda la temporada o un rango de fechas)
function calcularTabla(data, rango = {}) {
  const oro = fechasDeOroDe(data);
  const jugadores = new Map();
  const obtener = (nombre) => {
    const k = clave(nombre);
    if (!jugadores.has(k)) jugadores.set(k, nuevoJugador(nombre));
    return jugadores.get(k);
  };
  // El plantel aparece en la tabla aunque todavía no haya jugado
  for (const nombre of data.jugadores || []) obtener(nombre);

  const eventos = eventosDe(data, rango);
  for (const ev of eventos) {
    if (ev.tipo === 'partido') {
      const p = ev.p;
      const res = resultadoDe(p);
      const dif = diferenciaDe(p);
      const esOro = oro.has(p.fecha);
      const equipos = p.equipos.map((e) => e.jugadores.map(obtener));
      equipos.forEach((equipo, i) => {
        const letra = i === 0 ? 'A' : 'B';
        const r = res === 'empate' ? 'E' : res === letra ? 'G' : 'P';
        for (const j of equipo) {
          registrar(j, r, { fecha: p.fecha, oro: esOro, dif });
          j.presentes.add(p.fecha);
          for (const c of equipo) if (c !== j) sumarCruce(j.companeros, c.nombre, r);
          for (const rival of equipos[1 - i]) sumarCruce(j.rivales, rival.nombre, r);
        }
      });
      const figura = p.figura && equipos.flat().find((j) => clave(j.nombre) === clave(p.figura));
      if (figura) {
        figura.pts += PUNTO_FIGURA;
        figura.figuras++;
      }
    } else {
      // Fecha suspendida: los anotados cuentan como presentes; las bajas tarde pierden por W.O.
      const s = ev.s;
      const bajas = new Set((s.bajas || []).map(clave));
      for (const nombre of s.anotados || []) if (!bajas.has(clave(nombre))) obtener(nombre).presentes.add(s.fecha);
      for (const nombre of s.bajas || []) {
        const j = obtener(nombre);
        j.wo++;
        registrar(j, 'P', { fecha: s.fecha, dif: WO_DIFERENCIA, wo: true });
      }
    }
  }

  // Índice Batalla = promedio de puntos × √asistencia
  const totalFechas = new Set(eventos.map((e) => e.fecha)).size;
  const lista = [...jugadores.values()].map((j) => {
    const prom = j.pj ? j.pts / j.pj : 0;
    const asist = totalFechas ? j.presentes.size / totalFechas : 0;
    return Object.assign(j, { prom, asist, indice: prom * Math.sqrt(asist) });
  });
  // Se compara redondeado para que dos índices que se ven iguales empaten
  const r3 = (n) => Math.round(n * 1000);
  const comparar = (a, b) => r3(b.indice) - r3(a.indice) || b.pj - a.pj || b.pts - a.pts || b.dg - a.dg;
  // Los que todavía no jugaron van al fondo, sin posición
  lista.sort((a, b) => (b.pj > 0) - (a.pj > 0) || comparar(a, b) || a.nombre.localeCompare(b.nombre, 'es'));
  lista.forEach((j, i) => {
    if (!j.pj) j.pos = null;
    else j.pos = i > 0 && comparar(lista[i - 1], j) === 0 ? lista[i - 1].pos : i + 1;
  });
  return { jugadores: lista, totalFechas };
}

const buscarJugador = (tabla, nombre) => tabla.jugadores.find((j) => clave(j.nombre) === clave(nombre));

// Jugador del mes: misma fórmula del índice, solo con las fechas de ese mes
function jugadoresDelMes(data) {
  const hoyMes = isoHoy().slice(0, 7);
  const terminada = temporadaTerminada(data);
  const meses = [...new Set(eventosDe(data).map((e) => e.fecha.slice(0, 7)))].sort();
  return meses.map((mes) => {
    const tabla = calcularTabla(data, { desde: `${mes}-01`, hasta: `${mes}-31` });
    return {
      mes,
      cerrado: terminada || mes < hoyMes,
      ganadores: tabla.jugadores.filter((j) => j.pos === 1),
      tabla,
    };
  });
}

// Posición del jugador después de cada fecha (jugada o suspendida)
function evolucion(data, nombre) {
  const fechas = [...new Set(eventosDe(data).map((e) => e.fecha))];
  return fechas.map((fecha) => {
    const j = buscarJugador(calcularTabla(data, { hasta: fecha }), nombre);
    return { fecha, pos: j ? j.pos : null };
  });
}

// Compañero con el que más puntos promedia y rival contra el que menos (mínimo 2 partidos)
function cruces(j) {
  const promCruce = (c) => (c.g * 3 + c.e) / c.pj;
  const conMinimo = (mapa) => [...mapa.entries()].filter(([, c]) => c.pj >= 2);
  const dupla = conMinimo(j.companeros).sort(([, a], [, b]) => promCruce(b) - promCruce(a) || b.pj - a.pj)[0];
  const bestia = conMinimo(j.rivales).filter(([, c]) => c.p > 0)
    .sort(([, a], [, b]) => promCruce(a) - promCruce(b) || b.p - a.p)[0];
  return { dupla, bestia };
}

const LOGROS = [
  { id: 'llamas', icono: '🔥', nombre: 'En llamas', desc: 'Ganar 3 partidos seguidos', ok: (j) => j.mejorRachaG >= 3 },
  { id: 'invicto', icono: '🛡️', nombre: 'Invicto', desc: 'Jugar 5 partidos seguidos sin perder', ok: (j) => j.mejorRacha >= 5 },
  { id: 'oro', icono: '⭐', nombre: 'Oro puro', desc: 'Ganar una fecha de oro', ok: (j) => j.oroGanadas >= 1 },
  { id: 'paliza', icono: '💥', nombre: 'Paliza', desc: 'Ganar por 5 goles o más', ok: (j) => j.mayorGoleada >= 5 },
  { id: 'presente', icono: '🙋', nombre: 'Siempre presente', desc: '100% de asistencia con 4 fechas o más', ok: (j, ctx) => ctx.totalFechas >= 4 && j.presentes.size === ctx.totalFechas },
  { id: 'veterano', icono: '🎖️', nombre: 'Veterano', desc: 'Jugar 10 partidos', ok: (j) => j.pj - j.wo >= 10 },
  { id: 'fairplay', icono: '🤝', nombre: 'Fair play', desc: 'Jugar 8 partidos sin amonestaciones', ok: (j) => j.pj - j.wo >= 8 && j.wo === 0 },
  { id: 'mes', icono: '📅', nombre: 'Jugador del mes', desc: 'Ganar el premio al jugador del mes', ok: (j, ctx) => ctx.delMes.has(clave(j.nombre)) },
];

function logrosDe(j, ctx) {
  return LOGROS.map((l) => ({ ...l, logrado: Boolean(l.ok(j, ctx)) }));
}

// Contexto compartido para logros: fechas totales y ganadores de meses cerrados
function contextoLogros(data, tabla, meses) {
  const delMes = new Set();
  for (const m of meses) if (m.cerrado) for (const g of m.ganadores) delMes.add(clave(g.nombre));
  return { totalFechas: tabla.totalFechas, delMes };
}

// Récords de la temporada
function records(data, tabla) {
  const jug = tabla.jugadores.filter((j) => j.pj > 0);
  const maximo = (fn) => {
    const valor = Math.max(0, ...jug.map(fn));
    return valor > 0 ? { valor, nombres: jug.filter((j) => fn(j) === valor).map((j) => j.nombre) } : null;
  };
  const numeros = numerarFechas(data.partidos);
  let goleada = null;
  for (const p of data.partidos) {
    const res = resultadoDe(p);
    const dif = diferenciaDe(p);
    if (res === 'empate' || dif <= 0 || (goleada && dif <= goleada.valor)) continue;
    const ganador = p.equipos[res === 'A' ? 0 : 1];
    goleada = { valor: dif, nombres: ganador.jugadores.map((n) => n.trim()), fecha: p.fecha, numero: numeros.get(p.fecha) };
  }
  return {
    mejorRacha: maximo((j) => j.mejorRacha),
    rachaActual: maximo((j) => j.racha),
    victorias: maximo((j) => j.pg),
    presente: maximo((j) => j.presentes.size),
    goleada,
  };
}

// Salón de la fama: temporadas cerradas cargadas a mano + la actual cuando termina
function salonDeLaFama(data, tabla, meses) {
  const entradas = [...(data.historial || [])];
  if (temporadaTerminada(data) && data.partidos.length) {
    const enPuesto = (n) => tabla.jugadores.filter((j) => j.pos === n).map((j) => j.nombre);
    const rec = records(data, tabla);
    entradas.unshift({
      temporada: (data.temporada && data.temporada.nombre) || 'Temporada',
      campeon: enPuesto(1),
      segundo: enPuesto(2),
      tercero: enPuesto(3),
      mejorRacha: rec.mejorRacha,
      masPresente: rec.presente,
      jugadoresDelMes: meses.map((m) => ({ mes: m.mes, nombres: m.ganadores.map((g) => g.nombre) })),
    });
  }
  return entradas;
}
