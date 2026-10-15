// Interfaz PWA. Toda la lógica clínica vive en el servidor: aquí solo se presenta y se envía.
const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ETIQ = {
  fase_inicial: 'Fase inicial', entrevista: 'En entrevista', esperando_informe_escolar: 'Esperando informe escolar',
  entrevista_completa: 'Entrevista completa', informe_final: 'Informe final', validado: 'Validado',
  pendiente: 'Pendiente', en_curso: 'En curso', parcial: 'Parcial', resuelta: 'Resuelta', no_aplica: 'No aplica', pendiente_informe: 'Desde informe',
  con_informe: 'Con informe escolar', completa: 'Entrevista completa', incorporado: 'Incorporado', disponible: 'Disponible', revisado: 'Revisado', generado: 'Generado', bloqueado: 'Bloqueado', 'listo para generar': 'Listo para generar',
  sin_dato: 'Sin dato', contradiccion: 'Contradictorio', apoderado: 'Apoderado', informe_escolar: 'Informe escolar', valor: 'Valor', no_sabe: 'No sabe', no_recuerda: 'No recuerda', ambiguo: 'Ambiguo',
};
const DOM = { inatencion: 'Inatención', hiperactividad: 'Hiperactividad', impulsividad: 'Impulsividad', desarrollo: 'Desarrollo', trayectoria: 'Trayectoria', autonomia: 'Autonomía', funcionamiento: 'Funcionamiento', escolar: 'Escolar', tamizaje: 'Tamizaje' };
const et = (k) => ETIQ[k] || k;
const sv = (v) => (v === 'si' ? 'Sí' : v === 'no' ? 'No' : v);

let token = sessionStorage.getItem('tdah_token') || '';
let protocolo = null;

async function api(metodo, ruta, cuerpo) {
  let r;
  try {
    r = await fetch(ruta, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    document.getElementById('conexion').hidden = false;
    throw new Error('Sin conexión con el servidor. Los datos no se modificaron.');
  }
  document.getElementById('conexion').hidden = true;
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401) { pedirToken(token ? 'La clave ingresada no es correcta.' : ''); const e = new Error('Se requiere la clave de acceso.'); e.status = 401; throw e; }
  if (r.status === 503 && datos.configuracion_inicial) { configuracionInicial(); const e = new Error('Configuración inicial pendiente.'); e.status = 401; throw e; }
  if (!r.ok) { const e = new Error(datos.error || `Error ${r.status}`); e.detalle = datos.detalle; e.status = r.status; throw e; }
  return datos;
}

function aviso(msg, error = false) {
  const a = document.getElementById('aviso');
  a.textContent = msg; a.className = `aviso ver${error ? ' error' : ''}`;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { a.className = 'aviso'; }, 3800);
}

function pedirToken(error = '') {
  $app.innerHTML = `<div class="tarjeta" style="max-width:420px;margin:40px auto">
    <h2>Acceso</h2><p class="tenue">Ingrese la clave de acceso del sistema.</p>
    ${error ? `<p style="color:var(--ladrillo)">${esc(error)}</p>` : ''}
    <form id="ftoken"><label for="tok">Clave de acceso</label><input id="tok" type="password" autocomplete="current-password" required>
    <div class="fila" style="margin-top:12px"><button class="boton">Entrar</button></div></form></div>`;
  document.getElementById('ftoken').onsubmit = (e) => {
    e.preventDefault(); token = document.getElementById('tok').value.trim();
    sessionStorage.setItem('tdah_token', token); enrutar();
  };
}

function configuracionInicial() {
  $app.innerHTML = `<div class="tarjeta" style="max-width:460px;margin:40px auto">
    <h2>Configuración inicial</h2>
    <p class="tenue">Cree la clave de acceso del sistema. La necesitarán todos los profesionales para entrar. Se guarda cifrada y no se puede recuperar: anótela en un lugar seguro.</p>
    <form id="fconf"><label for="c1">Nueva clave (mínimo 12 caracteres)</label><input id="c1" type="password" autocomplete="new-password" minlength="12" required>
    <label for="c2">Repita la clave</label><input id="c2" type="password" autocomplete="new-password" minlength="12" required>
    <div class="fila" style="margin-top:12px"><button class="boton">Crear clave y entrar</button></div></form></div>`;
  document.getElementById('fconf').onsubmit = async (e) => {
    e.preventDefault();
    const c1 = document.getElementById('c1').value; const c2 = document.getElementById('c2').value;
    if (c1 !== c2) { aviso('Las claves no coinciden.', true); return; }
    try {
      await api('POST', '/api/configuracion-inicial', { clave: c1 });
      token = c1; sessionStorage.setItem('tdah_token', token);
      aviso('Clave creada.'); enrutar();
    } catch (err) { aviso(err.message, true); }
  };
}

// ------------------------------------------------------------ rutas ---
window.addEventListener('hashchange', enrutar);
async function enrutar() {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  try {
    if (!protocolo) {
      const salud = await api('GET', '/api/salud');
      if (salud.configuracion_inicial_pendiente) { configuracionInicial(); return; }
      protocolo = await api('GET', '/api/protocolo');
      const b = document.getElementById('protocolo');
      b.textContent = `Protocolo ${protocolo.version}${protocolo.estado === 'PROVISIONAL' ? ' · provisional' : ''} · IA: ${salud.ia.startsWith('deshab') ? 'reglas' : 'activa'}`;
      b.className = `insignia${protocolo.estado === 'PROVISIONAL' ? ' provisional' : ''}`;
      b.title = protocolo.aviso || '';
    }
    if (partes[0] === 'caso' && partes[1]) await vistaCaso(partes[1], partes[2] || 'entrevista');
    else await vistaCasos();
  } catch (e) {
    if (e.status !== 401) $app.innerHTML = `<div class="tarjeta"><h2>No se pudo cargar</h2><p>${esc(e.message)}</p><button class="boton sec" id="breintentar">Reintentar</button></div>`;
    const b = document.getElementById('breintentar'); if (b) b.onclick = () => location.reload();
  }
}

// ------------------------------------------------------- lista casos ---
async function vistaCasos() {
  const casos = await api('GET', '/api/casos');
  $app.innerHTML = `
    <div class="fila"><h1>Expedientes</h1><span class="espacio"></span></div>
    ${protocolo.estado === 'PROVISIONAL' ? `<div class="tarjeta" style="border-color:var(--ambar);background:var(--ambar-suave)"><strong>Protocolo provisional.</strong> ${esc(protocolo.aviso)}</div>` : ''}
    <form id="fnuevo" class="tarjeta" style="margin-top:14px">
      <h2>Nuevo caso</h2>
      <p class="tenue peq">Use un seudónimo o código interno. No ingrese nombres ni datos identificables de pacientes en entornos de prueba.</p>
      <div class="fila"><input id="etq" type="text" placeholder="Seudónimo del caso (p. ej. «Caso ficticio A»)" maxlength="80" style="flex:1;min-width:220px">
      <button class="boton">Crear e iniciar entrevista</button></div>
    </form>
    <div class="casos">${casos.length ? casos.map((c) => `
      <a class="caso-item" href="#/caso/${c.id}">
        <div><div><strong>${esc(c.etiqueta)}</strong></div><div class="codigo">${esc(c.codigo)} · actualizado ${new Date(c.actualizado).toLocaleString('es-CL')}</div></div>
        <span class="espacio"></span>
        ${c.ruta ? `<span class="estado pendiente">${esc(et(c.ruta))}</span>` : ''}
        <span class="estado ${esc(c.estado_global)}">${esc(et(c.estado_global))}</span>
      </a>`).join('') : '<p class="tenue">Aún no hay casos.</p>'}</div>`;
  document.getElementById('fnuevo').onsubmit = async (e) => {
    e.preventDefault();
    const v = await api('POST', '/api/casos', { etiqueta: document.getElementById('etq').value });
    location.hash = `#/caso/${v.caso.id}`;
  };
}

// ---------------------------------------------------------- caso ---
const PESTANAS = [['entrevista', 'Entrevista'], ['expediente', 'Expediente'], ['escolar', 'Informe escolar'], ['instrumentos', 'Instrumentos'], ['revision', 'Revisión profesional'], ['informe', 'Informe'], ['auditoria', 'Auditoría']];
let ultima = null;

async function vistaCaso(id, pestana) {
  const v = await api('GET', `/api/casos/${id}`);
  const c = v.caso;
  $app.innerHTML = `
    <div class="fila no-imprimir" style="margin-bottom:12px">
      <a href="#/" class="peq">← Expedientes</a><span class="espacio"></span>
    </div>
    <div class="fila" style="margin-bottom:14px">
      <div><h1 style="margin:0">${esc(c.etiqueta)}</h1><div class="codigo">${esc(c.codigo)} · protocolo ${esc(c.protocolo_version)}</div></div>
      <span class="espacio"></span>
      ${c.ruta ? `<span class="estado pendiente" title="${esc(v.ruta_justificacion)}">Ruta: ${esc(et(c.ruta))}</span>` : ''}
      <span class="estado ${esc(c.estado_global)}">${esc(et(c.estado_global))}</span>
    </div>
    <div class="caso">
      <aside class="lateral">${lateral(v)}</aside>
      <section>
        <nav class="pestanas">${PESTANAS.map(([k, n]) => `<a href="#/caso/${id}/${k}" class="${k === pestana ? 'activa' : ''}">${n}</a>`).join('')}</nav>
        <div id="contenido"></div>
      </section>
    </div>`;
  const cont = document.getElementById('contenido');
  const recargar = () => vistaCaso(id, pestana);
  ({ entrevista, expediente, escolar, instrumentos, revision, informe, auditoria }[pestana] || entrevista)(cont, v, recargar);
}

function lateral(v) {
  const porDom = {};
  for (const d of v.dimensiones) (porDom[d.dominio] ||= []).push(d);
  return `
    <div class="tarjeta"><h3>Flujo de evaluación</h3><ol class="flujo">${v.flujo.map((f) => `<li><span>${esc(f.etapa)}</span><span class="tenue peq">${esc(et(f.estado))}</span></li>`).join('')}</ol></div>
    <div class="tarjeta"><h3>Dimensiones</h3>${v.dimensiones.length ? `<ul class="dims">${Object.entries(porDom).map(([dom, ds]) =>
      `<li class="dom">${esc(DOM[dom] || dom)}</li>${ds.map((d) => `<li><span>${esc(d.nombre)}</span><span class="estado ${d.estado}">${esc(et(d.estado))}</span></li>`).join('')}`).join('')}</ul>`
      : '<p class="tenue peq">Disponibles al completar la fase inicial (motivo, edad, informe escolar, ruta).</p>'}</div>`;
}

// ------------------------------------------------------- entrevista ---
function entrevista(cont, v, recargar) {
  const c = v.caso; const q = c.pregunta_actual;
  if (!q) {
    const msj = {
      esperando_informe_escolar: ['La entrevista del hogar está completa.', 'Las dimensiones escolares se esperan del informe escolar. Cárguelo en la pestaña «Informe escolar»; si quedan vacíos, la entrevista se reabrirá solo para ellos. Si el informe finalmente no se puede obtener, puede cambiar la ruta.'],
      entrevista_completa: ['Entrevista completa.', 'Todas las dimensiones obligatorias fueron exploradas. Continúe con instrumentos, revisión profesional e informe.'],
      informe_final: ['Informe final generado.', 'Pendiente de validación profesional.'],
      validado: ['Evaluación validada.', ''],
    }[c.estado_global] || ['Sin pregunta vigente.', 'Revise la auditoría: el motor no encontró una pregunta autorizada.'];
    cont.innerHTML = `<div class="tarjeta pregunta"><h2>${esc(msj[0])}</h2><p class="tenue">${esc(msj[1])}</p>
      ${c.estado_global === 'esperando_informe_escolar' ? `<div class="fila"><a class="boton" href="#/caso/${c.id}/escolar">Cargar informe escolar</a>
      <button class="boton sec" id="bruta">El informe no se podrá obtener</button></div>` : ''}</div>`;
    const br = document.getElementById('bruta');
    if (br) br.onclick = async () => {
      const motivo = prompt('Motivo por el que el informe escolar no se podrá obtener:');
      if (!motivo) return;
      try { await api('POST', `/api/casos/${c.id}/ruta`, { ruta: 'completa', motivo }); aviso('Ruta cambiada a entrevista completa.'); recargar(); } catch (e) { aviso(e.message, true); }
    };
    return;
  }
  const esSiNo = q.tipo_dato === 'si_no';
  cont.innerHTML = `
    <div class="tarjeta pregunta">
      <div class="contexto">${esc(q.dimension)} · ${esc(q.etiqueta_dato)} · turno ${q.turno}</div>
      <p class="texto" id="ptexto">${esc(q.texto)}</p>
      <form id="fresp">
        <label for="resp">Respuesta del apoderado ${esSiNo ? '(puede escribir matices o usar los botones)' : '(texto literal)'}</label>
        ${q.tipo_dato === 'numero' ? '<input id="resp" type="text" inputmode="numeric" autocomplete="off">' : '<textarea id="resp" placeholder="Escriba la respuesta tal como la expresa el apoderado"></textarea>'}
        <div class="fila" style="margin-top:10px"><button class="boton" id="benviar">Registrar respuesta</button><span class="tenue peq">Ctrl + Enter</span></div>
        <div class="opciones">
          ${esSiNo ? '<button type="button" class="opcion" data-t="si">Sí</button><button type="button" class="opcion" data-t="no">No</button>' : ''}
          <button type="button" class="opcion inc" data-t="no_se">No sé</button>
          <button type="button" class="opcion inc" data-t="no_recuerdo">No recuerdo</button>
        </div>
      </form>
      <details class="porque"><summary>¿Por qué esta pregunta?</summary><p>${esc(q.justificacion)}</p><p class="mono">${esc(q.id)}</p></details>
      ${ultima && ultima.caso === c.id ? `<div class="ultima">Anterior: «${esc(ultima.pregunta)}» → <strong>${esc(ultima.interp)}</strong>${ultima.menciones ? ` · ${esc(ultima.menciones)}` : ''}</div>` : ''}
    </div>`;
  const input = document.getElementById('resp');
  input.focus();
  const enviar = async (tipo) => {
    const texto = input.value.trim();
    if (!texto && !tipo) { aviso('Escriba la respuesta o use un botón.', true); return; }
    cont.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const r = await api('POST', `/api/casos/${c.id}/respuestas`, { pregunta_id: q.id, texto, tipo });
      const i = r.traza.interpretacion;
      ultima = { caso: c.id, pregunta: q.texto.slice(0, 70) + (q.texto.length > 70 ? '…' : ''),
        interp: `${et(i.estado_dato)}${i.valor && !['si', 'no'].includes(i.valor) ? `: ${String(i.valor).slice(0, 60)}` : i.valor ? `: ${i.valor === 'si' ? 'Sí' : 'No'}` : ''}`,
        menciones: i.menciones.length ? `menciones detectadas: ${i.menciones.length}` : '' };
      if (r.traza.contradiccion) aviso('Se registró una contradicción (queda para revisión profesional).');
      else if (r.traza.error_api) aviso('La IA no respondió; se usó el intérprete de reglas.', true);
      recargar();
    } catch (e) {
      aviso(e.message, true);
      if (e.status === 409) recargar(); else cont.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  };
  document.getElementById('fresp').onsubmit = (e) => { e.preventDefault(); enviar(); };
  input.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } };
  cont.querySelectorAll('.opcion').forEach((b) => { b.onclick = () => enviar(b.dataset.t); });
}

// ------------------------------------------------------- expediente ---
function expediente(cont, v) {
  const nombreDim = (id) => (id === 'INI' ? 'Datos iniciales' : protocolo.dimensiones.find((d) => d.id === id)?.nombre || id);
  const slotEt = (s) => protocolo.slots[s]?.etiqueta || s;
  cont.innerHTML = `
    <div class="tarjeta"><h2>Datos iniciales</h2><table class="tabla"><tbody>
      ${Object.entries(v.iniciales).map(([k, s]) => `<tr><th>${esc(slotEt(k))}</th><td>${esc(s.estado === 'valor' ? sv(s.valor) : et(s.estado))}</td></tr>`).join('')}
      <tr><th>Ruta</th><td>${esc(v.ruta_justificacion || 'No determinada')}</td></tr></tbody></table></div>
    <div class="tarjeta"><h2>Dimensiones</h2><div class="desplaza"><table class="tabla"><thead><tr><th>Dimensión</th><th>Estado</th><th>Presencia</th><th>Faltantes</th><th>Preg.</th></tr></thead><tbody>
      ${v.dimensiones.map((d) => `<tr><td>${esc(d.nombre)}<div class="tenue peq">${esc(DOM[d.dominio])}</div></td><td><span class="estado ${d.estado}">${esc(et(d.estado))}</span></td>
        <td>${esc(d.slots.presencia.estado === 'valor' ? (d.slots.presencia.valor === 'si' ? 'Sí' : 'No') : et(d.slots.presencia.estado))}</td>
        <td class="peq">${esc(d.faltantes.map(slotEt).join(', '))}</td><td>${d.preguntas_hechas}</td></tr>`).join('') || '<tr><td colspan="5" class="tenue">Fase inicial en curso.</td></tr>'}
    </tbody></table></div></div>
    <div class="tarjeta"><h2>Hechos registrados (${v.hechos.length})</h2><p class="tenue peq">Cada dato conserva su fuente y su evidencia literal.</p><div class="desplaza"><table class="tabla"><thead><tr><th>Dimensión · dato</th><th>Estado / valor</th><th>Fuente</th><th>Evidencia</th></tr></thead><tbody>
      ${v.hechos.map((h) => `<tr><td>${esc(nombreDim(h.dimension_id))}<div class="tenue peq">${esc(slotEt(h.slot))}</div></td>
        <td>${esc(h.estado === 'valor' ? sv(h.valor) : et(h.estado))}</td><td>${esc(et(h.fuente))}${h.origen === 'mencion_espontanea' ? '<div class="tenue peq">mención espontánea</div>' : ''}</td><td class="peq">${esc(h.evidencia || '')}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="tarjeta"><h2>Contradicciones</h2>${v.contradicciones.length ? `<ul>${v.contradicciones.map((c) => `<li>${esc(nombreDim(c.dimension_id))}: ${esc(c.descripcion)} <span class="estado ${c.estado === 'revisada' ? 'ok' : 'mal'}">${esc(c.estado)}</span></li>`).join('')}</ul>` : '<p class="tenue">Sin contradicciones.</p>'}</div>`;
}

// ------------------------------------------------------ informe escolar ---
function escolar(cont, v, recargar) {
  const c = v.caso;
  cont.innerHTML = `
    <div class="tarjeta"><h2>Informe escolar</h2>
      <p class="tenue peq">Ruta actual: ${esc(et(c.ruta) || 'no determinada')}. El texto se procesa y cada dato extraído conserva la frase del informe como evidencia y la fuente «informe escolar».</p>
      <form id="finf"><label for="tinf">Texto del informe (pegar)</label><textarea id="tinf" style="min-height:180px" placeholder="Pegue aquí el contenido del informe escolar"></textarea>
      <label for="arch">o cargar archivo de texto (.txt)</label><input id="arch" type="file" accept=".txt,text/plain">
      <div class="fila" style="margin-top:12px"><button class="boton">Procesar informe</button></div></form>
    </div>
    ${v.informes_escolares.map((i) => `<div class="tarjeta"><div class="fila"><h3 style="margin:0">Informe cargado</h3><span class="espacio"></span><span class="tenue peq">${new Date(i.creado).toLocaleString('es-CL')} · método: ${esc(i.metodo)}</span></div>
      <table class="tabla" style="margin-top:8px"><thead><tr><th>Dimensión</th><th>Dato</th><th>Valor</th><th>Evidencia</th></tr></thead><tbody>
      ${i.extraccion.map((h) => `<tr><td>${esc(protocolo.dimensiones.find((d) => d.id === h.dimension_id)?.nombre)}</td><td>${esc(protocolo.slots[h.slot]?.etiqueta)}</td><td>${esc(sv(h.valor))}</td><td class="peq">«${esc(h.evidencia)}»</td></tr>`).join('') || '<tr><td colspan="4" class="tenue">No se extrajeron datos.</td></tr>'}
      </tbody></table></div>`).join('')}`;
  document.getElementById('arch').onchange = async (e) => {
    const f = e.target.files[0]; if (f) document.getElementById('tinf').value = await f.text();
  };
  document.getElementById('finf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('POST', `/api/casos/${c.id}/informe-escolar`, { texto: document.getElementById('tinf').value });
      aviso(`Informe procesado: ${r.extraidos.length} datos extraídos${r.contradicciones.length ? `, ${r.contradicciones.length} contradicción(es)` : ''}.`);
      recargar();
    } catch (err) { aviso(err.message, true); }
  };
}

// ----------------------------------------------------- instrumentos ---
function instrumentos(cont, v, recargar) {
  const c = v.caso;
  cont.innerHTML = `<p class="tenue peq">Los resultados de realidad virtual, Nesplora o de un instrumento aislado no determinan por sí solos un diagnóstico.</p>
  ${v.instrumentos.map((i) => {
    const ev = v.evaluaciones.find((e) => e.instrumento_id === i.id) || {};
    return `<form class="tarjeta finst" data-id="${esc(i.id)}">
      <div class="fila"><h3 style="margin:0">${esc(i.nombre)}</h3><span class="espacio"></span>${i.obligatorio ? '<span class="estado aviso">Obligatorio</span>' : '<span class="estado pendiente">Opcional</span>'}
      <span class="estado ${ev.estado === 'realizada' ? 'ok' : 'pendiente'}">${esc(ev.estado || 'pendiente')}</span></div>
      <div class="fila" style="align-items:end">
        <div style="flex:1;min-width:140px"><label>Estado</label><select name="estado">${['pendiente', 'realizada', 'no_aplica'].map((s) => `<option ${ev.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div style="flex:1;min-width:140px"><label>Fecha</label><input type="date" name="fecha" value="${esc(ev.fecha || '')}"></div>
        <div style="flex:2;min-width:180px"><label>Aplicador</label><input type="text" name="aplicador" value="${esc(ev.aplicador || '')}"></div>
      </div>
      <label>Resultados (una línea por indicador: «nombre: valor»)</label>
      <textarea name="resultados">${esc(ev.resultados ? Object.entries(ev.resultados).map(([k, x]) => `${k}: ${x}`).join('\n') : '')}</textarea>
      <label>Observaciones (obligatorias si «no_aplica»)</label><textarea name="observaciones" style="min-height:60px">${esc(ev.observaciones || '')}</textarea>
      <div class="fila" style="margin-top:10px"><button class="boton">Guardar</button></div></form>`;
  }).join('')}`;
  cont.querySelectorAll('.finst').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const res = {};
      for (const l of String(fd.get('resultados')).split('\n')) { const i = l.indexOf(':'); if (i > 0) res[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
      try {
        await api('POST', `/api/casos/${c.id}/evaluaciones`, { instrumento_id: f.dataset.id, estado: fd.get('estado'), fecha: fd.get('fecha') || null,
          aplicador: fd.get('aplicador') || null, resultados: Object.keys(res).length ? res : null, observaciones: fd.get('observaciones') || null });
        aviso('Instrumento registrado.'); recargar();
      } catch (err) { aviso(err.message, true); }
    };
  });
}

// ------------------------------------------------------- revisión ---
function revision(cont, v, recargar) {
  const c = v.caso;
  cont.innerHTML = `
    <div class="tarjeta"><h2>Contradicciones</h2><p class="tenue peq">Se registran sin resolverlas por suposición. El profesional las revisa y deja constancia; el dato contradictorio se conserva tal cual.</p>
    ${v.contradicciones.map((x) => `<form class="fcontr" data-id="${x.id}" style="border-top:1px solid var(--linea);padding-top:10px;margin-top:10px">
      <p>${esc(x.descripcion)} <span class="estado ${x.estado === 'revisada' ? 'ok' : 'mal'}">${esc(x.estado)}</span></p>
      ${x.estado === 'revisada' ? `<p class="tenue peq">Revisada por ${esc(x.revisado_por)}: ${esc(x.nota_revision)}</p>` : `
      <label>Nota de revisión</label><textarea name="nota" style="min-height:60px" required></textarea>
      <label>Profesional</label><input type="text" name="prof" required><div class="fila" style="margin-top:8px"><button class="boton">Marcar como revisada</button></div>`}
    </form>`).join('') || '<p class="tenue">Sin contradicciones.</p>'}</div>
    <form class="tarjeta" id="finterp"><h2>Interpretación clínica</h2>
      <p class="tenue peq">Redactada por el profesional responsable. El sistema no genera interpretación clínica.</p>
      <textarea id="tint" style="min-height:160px">${esc(c.interpretacion || '')}</textarea>
      <label>Profesional responsable</label><input type="text" id="pint" value="${esc(c.interpretacion_profesional || '')}">
      <div class="fila" style="margin-top:10px"><button class="boton">Guardar interpretación</button></div></form>`;
  cont.querySelectorAll('.fcontr').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(f);
      try { await api('POST', `/api/casos/${c.id}/contradicciones/${f.dataset.id}/revision`, { nota: fd.get('nota'), profesional: fd.get('prof') }); recargar(); } catch (err) { aviso(err.message, true); }
    };
  });
  document.getElementById('finterp').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('PUT', `/api/casos/${c.id}/interpretacion`, { texto: document.getElementById('tint').value, profesional: document.getElementById('pint').value }); aviso('Interpretación guardada.'); recargar(); } catch (err) { aviso(err.message, true); }
  };
}

// --------------------------------------------------------- informe ---
async function informe(cont, v, recargar) {
  const c = v.caso;
  const ultimoFinal = v.informes[v.informes.length - 1];
  const inf = ultimoFinal ? await api('GET', `/api/casos/${c.id}/informes/${ultimoFinal.id}`) : await api('GET', `/api/casos/${c.id}/informe`);
  const req = v.requisitos;
  cont.innerHTML = `
    <div class="tarjeta no-imprimir"><div class="fila"><h2 style="margin:0">Requisitos del informe final</h2><span class="espacio"></span>
      <span class="estado ${req.completo ? 'ok' : 'aviso'}">${req.completo ? 'Completos' : 'Evaluación pendiente'}</span></div>
      <ul class="req" style="margin-top:8px">${req.requisitos.map((r) => `<li><span class="ico ${r.cumplido ? 'si' : 'no'}">${r.cumplido ? '✓' : '✗'}</span><span>${esc(r.descripcion)}${r.detalle ? `<div class="tenue peq">${esc(r.detalle)}</div>` : ''}</span></li>`).join('')}</ul>
      <div class="fila" style="margin-top:12px">
        <button class="boton" id="bfinal" ${req.completo ? '' : 'disabled'}>Generar informe final</button>
        ${ultimoFinal && ultimoFinal.estado !== 'validado' ? '<button class="boton sec" id="bvalidar">Validar informe</button>' : ''}
        <button class="boton sec" id="bimprimir">Imprimir / PDF</button>
      </div></div>
    <article class="tarjeta informe">${inf.html}</article>`;
  document.getElementById('bimprimir').onclick = () => window.print();
  const bf = document.getElementById('bfinal');
  bf.onclick = async () => {
    try { await api('POST', `/api/casos/${c.id}/informes`); aviso('Informe final generado.'); recargar(); } catch (e) { aviso(e.message, true); }
  };
  const bv = document.getElementById('bvalidar');
  if (bv) bv.onclick = async () => {
    const profesional = prompt('Nombre del profesional que valida el informe:');
    if (!profesional) return;
    try { await api('POST', `/api/casos/${c.id}/informes/${ultimoFinal.id}/validacion`, { profesional }); aviso('Informe validado.'); recargar(); } catch (e) { aviso(e.message, true); }
  };
}

// ------------------------------------------------------- auditoría ---
async function auditoria(cont, v) {
  const a = await api('GET', `/api/casos/${v.caso.id}/auditoria`);
  cont.innerHTML = `
    <div class="tarjeta"><div class="fila"><h2 style="margin:0">Decisiones del motor (${a.decisiones.length})</h2><span class="espacio"></span>
      <button class="boton sec" id="bdesc">Descargar JSON</button></div>
      <div class="desplaza"><table class="tabla" style="margin-top:8px"><thead><tr><th>Turno</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>
      ${a.decisiones.slice().reverse().map((d) => `<tr><td>${d.turno}</td><td class="mono">${esc(d.tipo)}</td><td class="peq">${esc(resumenDecision(d))}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="tarjeta"><h2>Errores (${a.errores.length})</h2>${a.errores.length ? `<ul>${a.errores.map((e) => `<li class="peq"><span class="mono">${esc(e.origen)}</span> ${esc(e.mensaje)} — ${new Date(e.creado).toLocaleString('es-CL')}</li>`).join('')}</ul>` : '<p class="tenue">Sin errores.</p>'}</div>`;
  document.getElementById('bdesc').onclick = () => {
    const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = `auditoria-${v.caso.codigo}.json`; el.click();
  };
}

function resumenDecision(d) {
  const x = d.detalle;
  switch (d.tipo) {
    case 'pregunta_seleccionada': return `${x.pregunta_id} — ${x.justificacion}`;
    case 'respuesta_registrada': return `${x.pregunta_id}: «${x.texto_original || x.tipo_declarado}» → ${x.clasificacion} (${x.interprete})`;
    case 'preguntas_bloqueadas': return x.bloqueadas.map((b) => `${b.pregunta_id}: ${b.motivos.join('; ')}`).join(' | ');
    case 'ruta_determinada': return `${x.ruta} — ${x.justificacion}`;
    case 'mencion_detectada': return x.menciones.map((m) => `${m.dimension_id}: «${m.evidencia}»`).join(' | ');
    default: return JSON.stringify(x);
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
enrutar();
