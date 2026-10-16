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
const DOM = { inatencion: 'Inatención', hiperactividad_impulsividad: 'Hiperactividad / impulsividad' };
const CLASE_ESTADO = (e) => ({ 'APOYADO POR EVIDENCIA': 'mal', PROBABLE: 'aviso', POSIBLE: 'aviso', CONTRADICTORIO: 'mal', 'NO REFERIDO': 'ok', 'NO INFORMADO': 'pendiente', DESCONOCIDO: 'pendiente', 'INFORMACIÓN INSUFICIENTE': 'aviso' }[e] || 'en_curso');
const et = (k) => ETIQ[k] || k;
const sv = (v) => (v === 'si' ? 'Sí' : v === 'no' ? 'No' : String(v ?? '').split(',').map((x) => ETIQ[x] || x).join(', '));

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
      for (const ops of Object.values(protocolo.alternativas || {})) for (const o of ops) if (!ETIQ[o.valor] && !/^[A-Z]$/.test(o.valor)) ETIQ[o.valor] = o.texto;
      const b = document.getElementById('protocolo');
      b.textContent = `Protocolo ${protocolo.version}${protocolo.estado === 'PROVISIONAL' ? ' · provisional' : ''}`;
      b.className = `insignia${protocolo.estado === 'PROVISIONAL' ? ' provisional' : ''}`;
      b.title = protocolo.aviso || '';
    }
    if (partes[0] === 'caso' && partes[1]) await vistaCaso(partes[1], partes[2] || 'entrevista');
    else if (partes[0] === 'bibliografia') await vistaBibliografia(partes[1] || null);
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
      <label for="etq">Seudónimo del caso</label>
      <input id="etq" type="text" placeholder="p. ej. «Caso ficticio A»" maxlength="80">
      <fieldset class="consentimiento">
        <legend>Consentimiento informado del representante legal</legend>
        <p class="tenue peq" style="margin:0">Los datos de salud mental son datos sensibles: solo pueden tratarse con consentimiento expreso (Ley 19.628/21.719, Ley 20.584, Ley 21.331). Entregue al representante la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a> antes de registrarlo.</p>
        <div class="rejilla">
          <div><label for="cotorg">Otorgado por (nombre o N° de documento firmado)</label><input id="cotorg" type="text" maxlength="160" required></div>
          <div><label for="crel">Relación con el niño, niña o adolescente</label><select id="crel" required><option value="">Seleccione…</option><option value="madre">Madre</option><option value="padre">Padre</option><option value="tutor_legal">Tutor legal</option><option value="otro_representante_legal">Otro representante legal</option></select></div>
          <div><label for="cmedio">Medio</label><select id="cmedio" required><option value="escrito_firmado">Escrito firmado</option><option value="electronico">Electrónico</option><option value="verbal_registrado">Verbal registrado</option></select></div>
          <div><label for="cprof">Profesional que obtiene el consentimiento</label><input id="cprof" type="text" maxlength="120" required></div>
        </div>
        <label class="chk"><input id="cacepta" type="checkbox" required> <span>El representante legal fue informado de la finalidad, del uso de sus datos y de sus derechos, y <strong>consiente expresamente</strong> el tratamiento de los datos de salud del niño, niña o adolescente para esta evaluación.</span></label>
      </fieldset>
      <div class="fila" style="margin-top:12px"><button class="boton">Registrar consentimiento y crear caso</button></div>
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
    const val = (id) => document.getElementById(id).value;
    const v = await api('POST', '/api/casos', { etiqueta: val('etq'), consentimiento: {
      acepta: document.getElementById('cacepta').checked, otorgante: val('cotorg'), relacion: val('crel'), medio: val('cmedio'),
      profesional: val('cprof') } });
    location.hash = `#/caso/${v.caso.id}`;
  };
}

// ---------------------------------------------------------- caso ---
const PESTANAS = [['entrevista', 'Entrevista apoderado'], ['expediente', 'Expediente'], ['escolar', 'Informe escolar y colegio'], ['nna', 'Niño / adolescente'],
  ['instrumentos', 'Instrumentos y RV'], ['revision', 'Revisión profesional'], ['informe', 'Informe'], ['auditoria', 'Auditoría']];
let ultima = null;

async function vistaCaso(id, pestana) {
  const v = await api('GET', `/api/casos/${id}`);
  const c = v.caso;
  $app.innerHTML = `
    <div class="fila no-imprimir" style="margin-bottom:12px"><a href="#/" class="peq">← Expedientes</a><span class="espacio"></span></div>
    <div class="fila" style="margin-bottom:14px">
      <div><h1 style="margin:0">${esc(c.etiqueta)}</h1><div class="codigo">${esc(c.codigo)} · protocolo ${esc(c.protocolo_version)}${v.etapa_evolutiva ? ` · etapa evolutiva ${esc(v.etapa_evolutiva)}` : ''}</div></div>
      <span class="espacio"></span>
      ${c.ruta ? `<span class="estado pendiente" title="${esc(v.ruta_justificacion)}">${c.ruta === 'completa' ? 'Ruta A — sin informe' : 'Ruta B — con informe'}</span>` : ''}
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
  ({ entrevista, expediente, escolar, nna, instrumentos, revision, informe, auditoria }[pestana] || entrevista)(cont, v, recargar);
}

function lateral(v) {
  const I = v.integracion;
  return `
    <div class="tarjeta"><h3>Flujo de evaluación</h3><ol class="flujo">${v.flujo.map((f) => `<li><span>${esc(f.etapa)}</span><span class="tenue peq">${esc(et(f.estado))}</span></li>`).join('')}</ol></div>
    ${I ? `<div class="tarjeta"><h3>Contraste DSM-5-TR</h3>
      <p class="peq" style="margin:0 0 6px">Puerta de suficiencia: <strong>${esc(I.puerta)}</strong></p>
      <ul class="dims">${Object.entries(I.requisitos).map(([k, r]) => `<li><span>${k} ${esc(r.nombre)}</span><span class="estado ${/APOYADO|ALCANZADO|NINGUNA|REALIZADA/.test(r.estado) && !/NO /.test(r.estado) ? 'ok' : /INSUF|PENDIENTE/.test(r.estado) ? 'aviso' : 'pendiente'}">${esc(r.estado.toLowerCase())}</span></li>`).join('')}</ul></div>` : ''}
    <div class="tarjeta"><h3>18 síntomas DSM-5-TR</h3>${v.sintomas.length ? `<ul class="dims">${['inatencion', 'hiperactividad_impulsividad'].map((d) =>
      `<li class="dom">${DOM[d]}</li>${v.sintomas.filter((s) => s.dominio === d).map((s) => `<li title="${esc(s.nombre)}"><span>${s.id} ${esc(s.nombre.slice(0, 34))}${s.nombre.length > 34 ? '…' : ''}</span><span class="estado ${CLASE_ESTADO(s.estado)}">${esc(s.estado.toLowerCase().slice(0, 22))}</span></li>`).join('')}`).join('')}</ul>`
      : '<p class="tenue peq">Disponibles al completar la fase inicial.</p>'}</div>`;
}

// ------------------------------------------------------- entrevista ---
function formPregunta(q, { conTexto = true } = {}) {
  const ops = q.opciones || [];
  if (q.tipo === 'presencia' || q.tipo === 'opciones') {
    return `<div class="opciones-lista">${ops.map((o) => `<button type="button" class="opcion ${o.incierta ? 'inc' : ''}" data-op="${esc(o.codigo)}"><span class="letra">${esc(o.codigo)}</span> ${esc(o.texto)}</button>`).join('')}</div>
      ${conTexto ? `<details class="libre"><summary>Registrar la respuesta textual del apoderado</summary><textarea id="resp" placeholder="Respuesta literal (se asignará a una alternativa; si no es posible, queda como información parcial)"></textarea><div class="fila" style="margin-top:8px"><button class="boton sec" id="benviar">Registrar texto</button></div></details>` : ''}`;
  }
  if (q.tipo === 'multiple') {
    return `<p class="tenue peq">Puede seleccionar varias alternativas. Las marcadas como excluyentes no se combinan.</p>
      <div class="opciones-lista">${ops.map((o) => `<label class="opcion check ${o.incierta ? 'inc' : ''}"><input type="checkbox" value="${esc(o.codigo)}" ${o.excluyente ? 'data-exc="1"' : ''}><span class="letra">${esc(o.codigo)}</span> ${esc(o.texto)}${o.excluyente ? ' <em class="tenue peq">(excluyente)</em>' : ''}</label>`).join('')}</div>
      <div class="fila" style="margin-top:10px"><button class="boton" id="bmulti">Continuar</button></div>`;
  }
  return `<label for="resp">Respuesta ${q.tipo === 'numero' ? '(número)' : 'del informante (texto literal)'}</label>
    ${q.tipo === 'numero' ? '<input id="resp" type="text" inputmode="numeric" autocomplete="off">' : '<textarea id="resp"></textarea>'}
    <div class="fila" style="margin-top:10px"><button class="boton" id="benviar">Registrar respuesta</button>
    <button type="button" class="boton sec" data-tipo="no_se">No sabe</button><button type="button" class="boton sec" data-tipo="no_recuerdo">No recuerda</button></div>`;
}

function conectarForm(cont, enviar) {
  cont.querySelectorAll('[data-op]').forEach((b) => { b.onclick = () => enviar({ opcion: b.dataset.op }); });
  cont.querySelectorAll('[data-tipo]').forEach((b) => { b.onclick = () => enviar({ tipo: b.dataset.tipo }); });
  const be = cont.querySelector('#benviar');
  if (be) be.onclick = (e) => { e.preventDefault(); const t = cont.querySelector('#resp').value.trim(); if (!t) { aviso('Escriba la respuesta.', true); return; } enviar({ texto: t }); };
  const bm = cont.querySelector('#bmulti');
  if (bm) {
    const checks = [...cont.querySelectorAll('input[type=checkbox]')];
    checks.forEach((ch) => { ch.onchange = () => { if (ch.checked && ch.dataset.exc) checks.forEach((o) => { if (o !== ch) o.checked = false; }); else if (ch.checked) checks.filter((o) => o.dataset.exc).forEach((o) => { o.checked = false; }); }; });
    bm.onclick = () => { const sel = checks.filter((c) => c.checked).map((c) => c.value); if (!sel.length) { aviso('Seleccione al menos una alternativa.', true); return; } enviar({ opciones: sel }); };
  }
  const r = cont.querySelector('#resp');
  if (r) r.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); be?.click(); } };
}

function entrevista(cont, v, recargar) {
  const c = v.caso; const q = c.pregunta_actual;
  if (!q) {
    const msj = {
      esperando_informe_escolar: ['La entrevista del apoderado está completa.', 'Ruta B: la información escolar se obtiene del informe. Cárguelo en «Informe escolar y colegio»; si quedan vacíos, la entrevista se reabrirá solo para ellos. Si el informe no se podrá obtener, cambie a la Ruta A.'],
      entrevista_completa: ['Entrevista del apoderado completa.', 'El gate de cierre de la Etapa 9 se cumplió: barrido diferencial y tamizaje completos, sin ramas abiertas. Continúe con las demás fuentes, instrumentos, revisión profesional e informe.'],
      informe_final: ['Informe final generado.', 'Pendiente de validación profesional.'],
      validado: ['Evaluación validada.', ''],
    }[c.estado_global] || ['Sin pregunta vigente.', 'Revise la auditoría: el motor no encontró una pregunta autorizada.'];
    cont.innerHTML = `<div class="tarjeta pregunta"><h2>${esc(msj[0])}</h2><p class="tenue">${esc(msj[1])}</p>
      ${c.estado_global === 'esperando_informe_escolar' ? `<div class="fila"><a class="boton" href="#/caso/${c.id}/escolar">Cargar informe escolar</a><button class="boton sec" id="bruta">El informe no se podrá obtener</button></div>` : ''}</div>`;
    const br = document.getElementById('bruta');
    if (br) br.onclick = async () => {
      const motivo = window.prompt('Motivo por el que el informe escolar no se podrá obtener:');
      if (!motivo) return;
      try { await api('POST', `/api/casos/${c.id}/ruta`, { ruta: 'completa', motivo }); aviso('Ruta cambiada a Ruta A.'); recargar(); } catch (e) { aviso(e.message, true); }
    };
    return;
  }
  cont.innerHTML = `
    <div class="tarjeta pregunta">
      <div class="contexto">${esc(q.fase_nombre || '')} · turno ${q.turno} · <span class="mono">${esc(q.id)}</span></div>
      <p class="texto">${esc(q.texto)}</p>
      <div id="fresp">${formPregunta(q)}</div>
      <details class="porque"><summary>¿Por qué esta pregunta?</summary><p>${esc(q.justificacion)}</p><p class="mono peq">${esc(q.origen || '')}</p></details>
      <details class="duda"><summary>¿El apoderado tiene una duda?</summary>${cajaPregunta({ quien: 'apoderado', placeholder: 'p. ej. ¿Qué significa esta pregunta?' })}</details>
      ${ultima && ultima.caso === c.id ? `<div class="ultima">Anterior: «${esc(ultima.pregunta)}» → <strong>${esc(ultima.interp)}</strong>${ultima.extra ? ` · ${esc(ultima.extra)}` : ''}</div>` : ''}
    </div>`;
  conectarCaja(cont.querySelector('.duda'), { quien: 'apoderado', casoId: c.id, preguntaId: q.id });
  const enviar = async (r) => {
    cont.querySelectorAll('#fresp button, #fresp input').forEach((b) => { b.disabled = true; });
    try {
      const res = await api('POST', `/api/casos/${c.id}/respuestas`, { pregunta_id: q.id, ...r });
      const i = res.traza.interpretacion;
      ultima = { caso: c.id, pregunta: q.texto.slice(0, 70) + (q.texto.length > 70 ? '…' : ''), interp: res.traza.entrada.respuesta || i.estado_dato,
        extra: [i.menciones.length ? `evidencia relacionada: ${i.menciones.map((m) => m.sintoma).join(', ')}` : '', i.estado_dato === 'ambiguo' ? 'información parcial' : ''].filter(Boolean).join(' · ') };
      if (res.traza.contradiccion) aviso('Se registró una discrepancia (queda para revisión profesional).');
      recargar();
    } catch (e) {
      aviso(e.message, true);
      if (e.status === 409) recargar(); else cont.querySelectorAll('button, input').forEach((b) => { b.disabled = false; });
    }
  };
  conectarForm(cont, enviar);
}

// ------------------------------------------------------- expediente ---
function expediente(cont, v) {
  const I = v.integracion;
  cont.innerHTML = `
    <div class="tarjeta"><h2>Consentimiento y asentimiento</h2><table class="tabla"><tbody>
      ${(v.consentimientos || []).map((x) => `<tr><th>${x.tipo === 'tratamiento_datos' ? 'Representante legal' : 'Niño/niña/adolescente'}</th><td>${esc(x.otorgante)}${x.relacion && x.relacion !== 'nna' ? ` (${esc(x.relacion.replace(/_/g, ' '))})` : ''} · ${esc(x.medio.replace(/_/g, ' '))} · ${esc(x.profesional)} · ${new Date(x.creado).toLocaleDateString('es-CL')}<div class="tenue peq">Política de privacidad versión ${esc(x.version_politica)}</div></td></tr>`).join('') || '<tr><td class="tenue">Sin registro.</td></tr>'}
    </tbody></table></div>
    <div class="tarjeta"><h2>Datos iniciales</h2><table class="tabla"><tbody>
      ${Object.entries(v.iniciales).map(([k, s]) => `<tr><th>${esc(k.replace('_', ' '))}</th><td>${esc(s.estado === 'valor' ? sv(s.valor) : et(s.estado))}</td></tr>`).join('')}
      <tr><th>Ruta</th><td>${esc(v.ruta_justificacion || 'No determinada')}</td></tr></tbody></table></div>
    ${I ? `<div class="tarjeta"><h2>Estado de la hipótesis</h2><p><strong>${esc(I.resultado.titulo)}</strong></p><p class="tenue peq">${esc(I.resultado.umbral)} Puerta de suficiencia: ${esc(I.puerta)}.</p></div>` : ''}
    <div class="tarjeta"><h2>Síntomas DSM-5-TR</h2><div class="desplaza"><table class="tabla"><thead><tr><th>Código</th><th>Síntoma</th><th>Estado</th><th>Frecuencia</th><th>Desde</th><th>Contextos</th><th>Prof.</th></tr></thead><tbody>
      ${v.sintomas.map((s) => `<tr><td class="mono">${s.id}</td><td>${esc(s.nombre)}</td><td><span class="estado ${CLASE_ESTADO(s.estado)}">${esc(s.estado.toLowerCase())}</span></td>
        <td class="peq">${esc(et(s.frecuencia))}</td><td class="peq">${esc(et(s.desde))}</td><td class="peq">${esc(s.contextos.join(', '))}</td><td>${s.profundizacion}/3</td></tr>`).join('') || '<tr><td colspan="7" class="tenue">Fase inicial en curso.</td></tr>'}
    </tbody></table></div></div>
    ${v.barrido ? `<div class="tarjeta"><h2>Barrido diferencial y tamizaje</h2>
      <p><strong>Barrido diferencial:</strong> ${esc(v.barrido.estado)}${v.barrido.resultado ? ` — ${esc(v.barrido.resultado)}` : ''}</p>
      <ul>${v.barrido.ramas.map((r) => `<li>${esc(protocolo.barrido.opciones.find((o) => o.codigo === r.clave)?.texto)}: ${esc(r.diferencial)} (${esc(r.estado.toLowerCase())})</li>`).join('')}</ul>
      <p><strong>Tamizaje médico, sensorial y del sueño:</strong> ${esc(v.tamizaje.estado)} — ${esc(v.tamizaje.resultado)}</p>
      <ul>${v.tamizaje.ramas.map((r) => `<li>${esc(protocolo.tamizaje.opciones.find((o) => o.codigo === r.categoria)?.texto)} (${esc(r.estado.toLowerCase())})</li>`).join('')}
      ${v.tamizaje.alertas.map((a) => `<li style="color:var(--ladrillo)"><strong>Requiere valoración profesional:</strong> ${esc(a.motivo)}</li>`).join('')}</ul></div>` : ''}
    <div class="tarjeta"><h2>Hechos registrados (${v.hechos.length})</h2><p class="tenue peq">Cada dato conserva su fuente y su evidencia literal.</p><div class="desplaza"><table class="tabla"><thead><tr><th>Dato</th><th>Estado / valor</th><th>Fuente</th><th>Evidencia</th></tr></thead><tbody>
      ${v.hechos.map((h) => `<tr><td class="mono peq">${esc(h.dimension_id)} · ${esc(h.slot)}</td><td>${esc(h.estado === 'valor' ? sv(h.valor) : et(h.estado))}</td><td>${esc(et(h.fuente))}${h.origen === 'mencion_espontanea' ? '<div class="tenue peq">evidencia relacionada</div>' : ''}</td><td class="peq">${esc(h.evidencia || '')}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="tarjeta"><h2>Discrepancias</h2>${v.contradicciones.length ? `<ul>${v.contradicciones.map((c) => `<li>${esc(c.descripcion)} <span class="estado ${c.estado === 'revisada' ? 'ok' : 'mal'}">${esc(c.estado)}</span></li>`).join('')}</ul>` : '<p class="tenue">Sin discrepancias.</p>'}</div>`;
}

// ---------------------------------------------- informe escolar y colegio ---
function escolar(cont, v, recargar) {
  const c = v.caso;
  const enviar = (v.colegio || []).filter((q) => q.enviar);
  cont.innerHTML = `
    <div class="tarjeta"><h2>Informe escolar</h2>
      <p class="tenue peq">${c.ruta === 'con_informe' ? 'Ruta B: el informe es la fuente principal de información escolar.' : 'Ruta A: si se obtiene un informe, se incorpora como fuente independiente.'} Cada dato extraído conserva la frase del informe como evidencia.</p>
      <form id="finf"><label for="tinf">Texto del informe (pegar)</label><textarea id="tinf" style="min-height:160px"></textarea>
      <label for="arch">o cargar archivo de texto (.txt)</label><input id="arch" type="file" accept=".txt,text/plain">
      <div class="fila" style="margin-top:12px"><button class="boton">Procesar informe</button></div></form>
    </div>
    ${v.informes_escolares.map((i) => `<div class="tarjeta"><div class="fila"><h3 style="margin:0">Informe incorporado</h3><span class="espacio"></span><span class="tenue peq">${new Date(i.creado).toLocaleString('es-CL')} · ${esc(i.metodo)}</span></div>
      <table class="tabla" style="margin-top:8px"><thead><tr><th>Dato</th><th>Valor</th><th>Evidencia</th></tr></thead><tbody>
      ${i.extraccion.map((h) => `<tr><td class="mono peq">${esc(h.dimension_id)} · ${esc(h.slot)}</td><td>${esc(sv(h.valor))}</td><td class="peq">«${esc(h.evidencia)}»</td></tr>`).join('') || '<tr><td colspan="3" class="tenue">No se extrajeron datos.</td></tr>'}
      </tbody></table></div>`).join('')}
    <form class="tarjeta" id="fcol"><h2>Complementación del colegio (Anexo 7-C)</h2>
      <p class="tenue peq">Solo se envían las preguntas que el informe escolar no responde. Imprima o copie las pendientes y registre aquí las respuestas del colegio (fuente: profesor).</p>
      ${(v.colegio || []).map((q) => `<div style="border-top:1px solid var(--linea);padding:8px 0">
        <div class="fila"><span class="mono peq">${q.id}</span><span>${esc(q.texto)}</span><span class="espacio"></span>
        ${q.cubierta_por_informe ? '<span class="estado ok">cubierta por el informe</span>' : q.respondida ? '<span class="estado ok">respondida</span>' : q.enviar ? '<span class="estado aviso">enviar</span>' : '<span class="estado pendiente">tras el informe</span>'}</div>
        ${q.respondida ? `<p class="peq tenue">${esc(q.respuesta || '')}</p>` : q.enviar ? `<textarea name="${q.id}" style="min-height:50px" placeholder="Respuesta del colegio"></textarea>` : ''}</div>`).join('')}
      <div class="fila" style="margin-top:10px">${enviar.length ? '<button class="boton">Registrar respuestas del colegio</button>' : ''}<button type="button" class="boton sec" id="bimpcol">Imprimir preguntas pendientes</button></div>
    </form>`;
  document.getElementById('arch').onchange = async (e) => { const f = e.target.files[0]; if (f) document.getElementById('tinf').value = await f.text(); };
  document.getElementById('finf').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('POST', `/api/casos/${c.id}/informe-escolar`, { texto: document.getElementById('tinf').value }); aviso(`Informe procesado: ${r.extraidos.length} datos${r.contradicciones.length ? `, ${r.contradicciones.length} discrepancia(s)` : ''}.`); recargar(); } catch (err) { aviso(err.message, true); }
  };
  document.getElementById('fcol').onsubmit = async (e) => {
    e.preventDefault();
    const respuestas = [...new FormData(e.target).entries()].filter(([, t]) => String(t).trim()).map(([pregunta_id, texto]) => ({ pregunta_id, texto }));
    if (!respuestas.length) { aviso('Escriba al menos una respuesta.', true); return; }
    try { await api('POST', `/api/casos/${c.id}/colegio`, { respuestas }); aviso('Respuestas del colegio registradas.'); recargar(); } catch (err) { aviso(err.message, true); }
  };
  document.getElementById('bimpcol').onclick = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<title>Preguntas para el colegio — ${esc(c.codigo)}</title><h2>Preguntas de complementación — ${esc(c.codigo)}</h2><ol>${enviar.map((q) => `<li style="margin-bottom:40px">${esc(q.texto)}</li>`).join('')}</ol>`);
    w.document.close(); w.print();
  };
}

// --------------------------------------------- niño / adolescente ---
function nna(cont, v, recargar) {
  const c = v.caso; const s = v.nna;
  if (!s) { cont.innerHTML = '<div class="tarjeta"><p class="tenue">Primero debe registrarse la edad en la entrevista del apoderado.</p></div>'; return; }
  const titulo = s.fuente === 'nino' ? 'Entrevista al niño o niña (Anexo 7-D)' : 'Entrevista al adolescente (Anexo 7-E)';
  if (s.cerrada || !s.siguiente) {
    cont.innerHTML = `<div class="tarjeta"><h2>${titulo}</h2><p>${s.cerrada ? 'Entrevista finalizada.' : 'Todas las preguntas fueron respondidas.'} (${s.respondidas}/${s.banco})</p>
      ${!s.cerrada ? '<button class="boton" id="bfin">Finalizar entrevista</button>' : ''}</div>`;
    const b = document.getElementById('bfin'); if (b) b.onclick = async () => { await api('POST', `/api/casos/${c.id}/nna`, { finalizar: true }); recargar(); };
    return;
  }
  if (!s.asentimiento) {
    cont.innerHTML = `<form class="tarjeta" id="fasent"><h2>${titulo}</h2>
      <p>Antes de entrevistar al ${s.fuente === 'nino' ? 'niño o niña' : 'adolescente'}, explíquele con palabras adecuadas a su edad para qué son las preguntas, que puede no responder alguna y que lo que diga se usará solo para ayudarle. Registre que acepta participar (derecho a ser informado y oído, Ley 21.331 art. 25).</p>
      <label class="chk" style="display:flex;gap:8px"><input type="checkbox" id="aacepta" required> <span>Fue informado y acepta participar (asentimiento).</span></label>
      <label for="aprof">Profesional</label><input id="aprof" type="text" maxlength="120" required>
      <div class="fila" style="margin-top:10px"><button class="boton">Registrar asentimiento</button></div></form>`;
    document.getElementById('fasent').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('POST', `/api/casos/${c.id}/nna`, { asentimiento: { acepta: document.getElementById('aacepta').checked, profesional: document.getElementById('aprof').value } }); recargar(); } catch (er) { aviso(er.message, true); }
    };
    return;
  }
  const q = s.siguiente;
  cont.innerHTML = `<div class="tarjeta pregunta"><div class="contexto">${titulo} · ${s.respondidas + 1} de ${s.banco} · fuente propia: no repite la entrevista del apoderado</div>
    <p class="texto">${esc(q.texto)}</p>
    <label for="resp">Respuesta del ${s.fuente === 'nino' ? 'niño o niña' : 'adolescente'} (texto literal)</label><textarea id="resp"></textarea>
    <div class="fila" style="margin-top:10px"><button class="boton" id="benviar">Registrar</button><button class="boton sec" id="bomit">Omitir</button><span class="espacio"></span><button class="boton sec" id="bfin">Finalizar entrevista</button></div></div>`;
  const post = async (b) => { try { await api('POST', `/api/casos/${c.id}/nna`, b); recargar(); } catch (e) { aviso(e.message, true); } };
  document.getElementById('benviar').onclick = () => post({ pregunta_id: q.id, texto: document.getElementById('resp').value });
  document.getElementById('bomit').onclick = () => post({ pregunta_id: q.id, omitir: true });
  document.getElementById('bfin').onclick = () => post({ finalizar: true });
}

// ----------------------------------------------------- instrumentos ---
function instrumentos(cont, v, recargar) {
  const c = v.caso;
  cont.innerHTML = `<p class="tenue peq">La realidad virtual, Nesplora o un instrumento aislado no determinan por sí solos un diagnóstico: aportan evidencia complementaria de las variables que realmente miden (Etapa 9 §18).</p>
  ${v.instrumentos.map((i) => {
    const ev = v.evaluaciones.find((e) => e.instrumento_id === i.id) || {};
    return `<form class="tarjeta finst" data-id="${esc(i.id)}">
      <div class="fila"><h3 style="margin:0">${esc(i.nombre)}</h3><span class="espacio"></span><span class="estado ${ev.estado === 'realizada' ? 'ok' : 'pendiente'}">${esc(ev.estado || 'pendiente')}</span></div>
      <div class="fila" style="align-items:end">
        <div style="flex:1;min-width:140px"><label>Estado</label><select name="estado">${['pendiente', 'realizada', 'no_aplica'].map((s) => `<option ${ev.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div style="flex:1;min-width:140px"><label>Fecha</label><input type="date" name="fecha" value="${esc(ev.fecha || '')}"></div>
        <div style="flex:2;min-width:180px"><label>Aplicador</label><input type="text" name="aplicador" value="${esc(ev.aplicador || '')}"></div>
      </div>
      <label>Resultados (una línea por variable: «nombre: valor»; p. ej. «Omisiones: percentil 12»)</label>
      <textarea name="resultados">${esc(ev.resultados ? Object.entries(ev.resultados).map(([k, x]) => `${k}: ${x}`).join('\n') : '')}</textarea>
      <label>Observaciones (condiciones de evaluación; obligatorias si «no_aplica»)</label><textarea name="observaciones" style="min-height:60px">${esc(ev.observaciones || '')}</textarea>
      <div class="fila" style="margin-top:10px"><button class="boton">Guardar</button></div></form>`;
  }).join('')}`;
  cont.querySelectorAll('.finst').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(f); const res = {};
      for (const l of String(fd.get('resultados')).split('\n')) { const i = l.indexOf(':'); if (i > 0) res[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
      try {
        await api('POST', `/api/casos/${c.id}/evaluaciones`, { instrumento_id: f.dataset.id, estado: fd.get('estado'), fecha: fd.get('fecha') || null, aplicador: fd.get('aplicador') || null, resultados: Object.keys(res).length ? res : null, observaciones: fd.get('observaciones') || null });
        aviso('Instrumento registrado.'); recargar();
      } catch (err) { aviso(err.message, true); }
    };
  });
}

// ------------------------------------------------------- revisión ---
function revision(cont, v, recargar) {
  const c = v.caso;
  cont.innerHTML = `
    <div class="tarjeta"><h2>Discrepancias entre fuentes</h2><p class="tenue peq">Se conservan sin resolver por suposición. El profesional las revisa y deja constancia (Etapa 9 §11).</p>
    ${v.contradicciones.map((x) => `<form class="fcontr" data-id="${x.id}" style="border-top:1px solid var(--linea);padding-top:10px;margin-top:10px">
      <p>${esc(x.descripcion)} <span class="estado ${x.estado === 'revisada' ? 'ok' : 'mal'}">${esc(x.estado)}</span></p>
      ${x.estado === 'revisada' ? `<p class="tenue peq">Revisada por ${esc(x.revisado_por)}: ${esc(x.nota_revision)}</p>` : `
      <label>Nota de revisión</label><textarea name="nota" style="min-height:60px" required></textarea>
      <label>Profesional</label><input type="text" name="prof" required><div class="fila" style="margin-top:8px"><button class="boton">Marcar como revisada</button></div>`}
    </form>`).join('') || '<p class="tenue">Sin discrepancias.</p>'}</div>
    <div class="tarjeta"><h2>Preguntas del apoderado (${(v.consultas || []).filter((x) => x.quien === 'apoderado').length})</h2>
      <p class="tenue peq">Dudas planteadas durante la entrevista y cómo las respondió la app. Las que quedaron sin respuesta deben ser respondidas por el profesional.</p>
      ${(v.consultas || []).filter((x) => x.quien === 'apoderado').map((x) => `<div class="consulta" style="border-top:1px solid var(--linea);padding-top:8px;margin-top:8px">
        <p><strong>«${esc(x.pregunta)}»</strong> <span class="estado ${x.origen === 'sin_respuesta' && !x.atendida ? 'mal' : 'ok'}">${x.atendida ? 'atendida' : esc({ app: 'respondida por la app', internet: 'respondida con fuentes', sin_respuesta: 'sin respuesta' }[x.origen])}</span></p>
        ${x.pregunta_id ? `<p class="tenue peq">Durante la pregunta ${esc(x.pregunta_id)} · ${new Date(x.creado).toLocaleString('es-CL')}</p>` : ''}
        ${!x.atendida ? `<button class="boton sec peq batend" data-id="${x.id}">Marcar como atendida</button>` : ''}</div>`).join('') || '<p class="tenue">Sin preguntas.</p>'}</div>
    <form class="tarjeta" id="finterp"><h2>Interpretación y decisión clínica</h2>
      <p class="tenue peq">La redacta el profesional responsable. El sistema entrega una hipótesis estructurada; la decisión final no es automática (Etapa 9 §1 y §28).</p>
      <textarea id="tint" style="min-height:160px">${esc(c.interpretacion || '')}</textarea>
      <label>Profesional responsable</label><input type="text" id="pint" value="${esc(c.interpretacion_profesional || '')}">
      <div class="fila" style="margin-top:10px"><button class="boton">Guardar</button></div></form>`;
  cont.querySelectorAll('.batend').forEach((b) => { b.onclick = async () => { try { await api('POST', `/api/casos/${c.id}/consultas/${b.dataset.id}/atendida`, {}); recargar(); } catch (e) { aviso(e.message, true); } }; });
  cont.querySelectorAll('.fcontr').forEach((f) => {
    f.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(f); try { await api('POST', `/api/casos/${c.id}/contradicciones/${f.dataset.id}/revision`, { nota: fd.get('nota'), profesional: fd.get('prof') }); recargar(); } catch (err) { aviso(err.message, true); } };
  });
  document.getElementById('finterp').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('PUT', `/api/casos/${c.id}/interpretacion`, { texto: document.getElementById('tint').value, profesional: document.getElementById('pint').value }); aviso('Guardado.'); recargar(); } catch (err) { aviso(err.message, true); }
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
    <div class="tarjeta no-imprimir"><div class="fila"><h2 style="margin:0">Bibliografía del caso (${(v.referencias || []).length})</h2><span class="espacio"></span><a class="boton sec" href="#/bibliografia/${c.id}">Preguntas y evidencia</a></div>
      ${(v.referencias || []).length ? `<ul class="refs">${v.referencias.map((r) => `<li><a href="${esc(r.referencia.url)}" target="_blank" rel="noopener noreferrer">${esc(r.referencia.titulo)}</a><div class="tenue peq">${esc([r.referencia.autores, r.referencia.revista, r.referencia.anio].filter(Boolean).join(' · '))}${r.nota ? ` — ${esc(r.nota)}` : ''}</div><button class="boton sec peq bquitar" data-id="${r.id}">Quitar</button></li>`).join('')}</ul>` : '<p class="tenue peq">Aún no hay referencias. Las que agregue aparecerán al final del informe.</p>'}</div>
    <article class="tarjeta informe">${inf.html}</article>`;
  cont.querySelectorAll('.bquitar').forEach((b) => { b.onclick = async () => { try { await api('DELETE', `/api/casos/${c.id}/referencias/${b.dataset.id}`, {}); recargar(); } catch (e) { aviso(e.message, true); } }; });
  document.getElementById('bimprimir').onclick = () => window.print();
  document.getElementById('bfinal').onclick = async () => { try { await api('POST', `/api/casos/${c.id}/informes`); aviso('Informe final generado.'); recargar(); } catch (e) { aviso(e.message, true); } };
  const bv = document.getElementById('bvalidar');
  if (bv) bv.onclick = async () => {
    const profesional = window.prompt('Nombre del profesional que valida el informe:');
    if (!profesional) return;
    try { await api('POST', `/api/casos/${c.id}/informes/${ultimoFinal.id}/validacion`, { profesional }); aviso('Informe validado.'); recargar(); } catch (e) { aviso(e.message, true); }
  };
}

// ------------------------------------------------ preguntas a la app ---
function cajaPregunta({ quien, placeholder }) {
  return `<form class="caja-pregunta" data-quien="${quien}"><div class="fila"><input type="search" name="p" maxlength="300" required placeholder="${esc(placeholder)}" style="flex:1;min-width:200px"><button class="boton sec">Preguntar</button></div>
    <p class="tenue peq" style="margin:6px 0 0">${quien === 'apoderado' ? 'Respuesta general de la app. Si no la encuentra, busca en fuentes científicas y, si tampoco, la pregunta queda registrada para el profesional.' : 'La app responde con su propio contenido; si no encuentra la respuesta, busca sola en literatura científica (solo envía términos clínicos, nunca datos del paciente).'}</p>
    <div class="respuesta-app" aria-live="polite"></div></form>`;
}

function pintarRespuesta(r, { casoId, agregar } = {}) {
  if (r.origen === 'sin_respuesta') return `<div class="resp sin">${esc(r.aviso || 'No encontramos una respuesta.')}</div>`;
  if (r.origen === 'app') return r.respuestas.map((x) => `<div class="resp"><strong>${esc(x.titulo)}</strong><p>${esc(x.texto)}</p></div>`).join('');
  return `<div class="resp"><strong>Según la literatura científica</strong>
    ${r.respuestas.map((x, i) => `<blockquote lang="en">${esc(x.cita)}<sup>${i + 1}</sup></blockquote>`).join('')}
    <div class="refs-resp"><div class="etq">Referencias</div><ol>${r.respuestas.map((x) => `<li><a href="${esc(x.articulo.url)}" target="_blank" rel="noopener noreferrer">${esc(x.articulo.titulo)}</a>. ${esc([x.articulo.autores, x.articulo.revista, x.articulo.anio].filter(Boolean).join(' · '))}
      ${agregar && casoId ? ` <button type="button" class="boton sec peq bagr" data-id="${esc(x.articulo.id)}">Agregar al informe</button>` : ''}</li>`).join('')}</ol></div>
    <p class="tenue peq">Información general de publicaciones científicas; no reemplaza la evaluación del profesional.</p></div>`;
}

function conectarCaja(root, { quien, casoId, preguntaId, agregar, profesional }) {
  const f = root?.querySelector('.caja-pregunta') || (root?.classList?.contains('caja-pregunta') ? root : null);
  if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const out = f.querySelector('.respuesta-app'); out.innerHTML = '<p class="cargando">Buscando respuesta…</p>';
    try {
      const r = await api('POST', '/api/consultas', { pregunta: f.p.value, quien, caso_id: casoId || undefined, pregunta_id: preguntaId || undefined });
      out.innerHTML = pintarRespuesta(r, { casoId, agregar });
      out.querySelectorAll('.bagr').forEach((b) => { b.onclick = async () => {
        try { await api('POST', `/api/casos/${casoId}/referencias`, { referencia_id: b.dataset.id, fuente: 'europepmc', profesional: profesional ? profesional() : '' }); b.textContent = 'Agregada ✓'; b.disabled = true; }
        catch (er) { aviso(er.message, true); }
      }; });
    } catch (er) { out.innerHTML = `<div class="resp sin">${esc(er.message)}</div>`; }
  };
}

// ------------------------------------------- búsqueda bibliográfica ---
let ultimaBusqueda = null;
async function vistaBibliografia(casoId) {
  const [sug, casos] = await Promise.all([api('GET', '/api/bibliografia/sugerencias'), api('GET', '/api/casos')]);
  const caso = casoId ? casos.find((c) => c.id === casoId) : null;
  $app.innerHTML = `
    <div class="fila">${caso ? `<a href="#/caso/${caso.id}/informe">← ${esc(caso.etiqueta)}</a>` : '<a href="#/">← Expedientes</a>'}</div>
    <h1>Preguntas y evidencia</h1>
    <div class="tarjeta" id="cajaprof"><h2>Haga una pregunta</h2>${cajaPregunta({ quien: 'profesional', placeholder: 'p. ej. ¿Qué dice la evidencia sobre melatonina en niños con TDAH?' })}</div>
    <h2 style="margin-top:22px">Búsqueda bibliográfica manual</h2>
    <p class="tenue">Literatura científica sobre criterios diagnósticos DSM-5 y entrevistas para TDAH, desde Europe PMC y PubMed. <strong>Solo se envían los términos que escriba: nunca datos del paciente.</strong></p>
    <form class="tarjeta" id="fbib">
      <div class="fila"><input id="bq" type="search" maxlength="200" placeholder="p. ej. ADHD DSM-5 diagnostic interview children" style="flex:1;min-width:220px" required>
        <select id="bf">${sug.fuentes.map((f) => `<option value="${f.id}">${esc(f.nombre)}</option>`).join('')}</select>
        <button class="boton">Buscar</button></div>
      <div class="chips">${sug.sugeridas.map((s, i) => `<button type="button" class="chip" data-i="${i}">${esc(s.etiqueta)}</button>`).join('')}</div>
      ${caso ? `<div class="rejilla-bib"><div><label for="bprof">Profesional que agrega referencias</label><input id="bprof" type="text" maxlength="120"></div><div><label for="bnota">Nota (opcional)</label><input id="bnota" type="text" maxlength="500" placeholder="Para qué respalda el informe"></div></div>` : '<p class="tenue peq">Para agregar referencias al informe de un caso, abra esta búsqueda desde la pestaña «Informe» del caso.</p>'}
    </form>
    <div id="bres"></div>`;
  conectarCaja(document.getElementById('cajaprof'), { quien: 'profesional', casoId: caso?.id, agregar: Boolean(caso), profesional: () => document.getElementById('bprof')?.value || '' });
  const pintar = (r) => {
    const cont = document.getElementById('bres');
    if (!r) { cont.innerHTML = ''; return; }
    cont.innerHTML = `<p class="tenue peq">${r.total.toLocaleString('es-CL')} resultados en ${esc(r.fuente_nombre)} para «${esc(r.consulta)}»${r.en_cache ? ' · desde caché' : ''}. Se muestran los más relevantes.</p>
      ${r.resultados.map((x) => `<article class="tarjeta resultado">
        <a class="titulo-ref" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.titulo)}</a>
        <div class="tenue peq">${esc([x.autores, x.revista, x.anio].filter(Boolean).join(' · '))}${x.acceso_abierto ? ' · <span class="estado ok">acceso abierto</span>' : ''}${x.pmid ? ` · PMID ${esc(x.pmid)}` : ''}</div>
        ${x.resumen ? `<details><summary class="peq">Resumen</summary><p class="peq">${esc(x.resumen)}</p></details>` : ''}
        ${caso ? `<button class="boton sec peq bagregar" data-id="${esc(x.id)}">Agregar al informe del caso</button>` : ''}
      </article>`).join('') || '<p class="tenue">Sin resultados.</p>'}`;
    cont.querySelectorAll('.bagregar').forEach((b) => { b.onclick = async () => {
      try {
        await api('POST', `/api/casos/${caso.id}/referencias`, { referencia_id: b.dataset.id, fuente: r.fuente, profesional: document.getElementById('bprof').value, nota: document.getElementById('bnota').value });
        b.textContent = 'Agregada ✓'; b.disabled = true; aviso('Referencia agregada al informe del caso.');
      } catch (e) { aviso(e.message, true); }
    }; });
  };
  const buscar = async (q) => {
    const cont = document.getElementById('bres'); cont.innerHTML = '<p class="cargando">Buscando…</p>';
    try {
      ultimaBusqueda = await api('GET', `/api/bibliografia?q=${encodeURIComponent(q)}&fuente=${document.getElementById('bf').value}&n=15`);
      pintar(ultimaBusqueda);
    } catch (e) { cont.innerHTML = `<div class="tarjeta"><p>${esc(e.message)}</p></div>`; }
  };
  document.getElementById('fbib').onsubmit = (e) => { e.preventDefault(); buscar(document.getElementById('bq').value); };
  document.querySelectorAll('.chip').forEach((b) => { b.onclick = () => { const q = sug.sugeridas[Number(b.dataset.i)].consulta; document.getElementById('bq').value = q; buscar(q); }; });
  if (ultimaBusqueda) { document.getElementById('bq').value = ultimaBusqueda.consulta; pintar(ultimaBusqueda); }
}

// ------------------------------------------------------- auditoría ---
async function auditoria(cont, v) {
  const a = await api('GET', `/api/casos/${v.caso.id}/auditoria`);
  cont.innerHTML = `
    <div class="tarjeta"><div class="fila"><h2 style="margin:0">Decisiones del motor (${a.decisiones.length})</h2><span class="espacio"></span><button class="boton sec" id="bdesc">Descargar auditoría</button><button class="boton sec" id="bexp" title="Derecho de acceso y portabilidad del titular">Exportar expediente completo</button></div>
      <div class="desplaza"><table class="tabla" style="margin-top:8px"><thead><tr><th>Turno</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>
      ${a.decisiones.slice().reverse().map((d) => `<tr><td>${d.turno}</td><td class="mono">${esc(d.tipo)}</td><td class="peq">${esc(resumenDecision(d))}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="tarjeta"><h2>Errores (${a.errores.length})</h2>${a.errores.length ? `<ul>${a.errores.map((e) => `<li class="peq"><span class="mono">${esc(e.origen)}</span> ${esc(e.mensaje)} — ${new Date(e.creado).toLocaleString('es-CL')}</li>`).join('')}</ul>` : '<p class="tenue">Sin errores.</p>'}</div>`;
  document.getElementById('bdesc').onclick = () => {
    const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = `auditoria-${v.caso.codigo}.json`; el.click();
  };
  document.getElementById('bexp').onclick = async () => {
    const x = await api('GET', `/api/casos/${v.caso.id}/exportar?solicitante=${encodeURIComponent('profesional (desde la interfaz)')}`);
    const blob = new Blob([JSON.stringify(x, null, 2)], { type: 'application/json' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = `expediente-${v.caso.codigo}.json`; el.click();
  };
}

function resumenDecision(d) {
  const x = d.detalle;
  switch (d.tipo) {
    case 'pregunta_seleccionada': return `${x.pregunta_id} [${x.fase}] — ${x.justificacion}`;
    case 'respuesta_registrada': return `${x.pregunta_id}: «${x.texto_original}» → ${x.estado_dato}${x.valor ? ` (${x.valor})` : ''} [${x.interprete}]`;
    case 'preguntas_descartadas': return x.descartadas.map((b) => `${b.pregunta_id}: ${b.motivos.join('; ')}`).join(' | ');
    case 'ruta_determinada': return `${x.ruta} — ${x.justificacion}`;
    case 'evidencia_relacionada_detectada': return x.menciones.map((m) => `${m.sintoma}: «${m.evidencia}»`).join(' | ');
    default: return JSON.stringify(x);
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
enrutar();
