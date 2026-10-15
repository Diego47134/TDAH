#!/usr/bin/env python3
"""
Construye protocol/protocolo.json a partir de los documentos vigentes del proyecto
(protocol/fuentes/*.docx convertidos a texto con pandoc).

Las preguntas del Anexo 7 se extraen LITERALMENTE del documento; este script solo
agrega la estructura operativa (identificadores, tipo de respuesta, vínculo con
síntomas DSM-5-TR / áreas / fases) que la Etapa 9 exige al motor.
Cada decisión que no está explícita en los documentos queda registrada en
docs/DOCUMENTOS_Y_CONTRADICCIONES.md (decisiones D#).

Uso:  python3 scripts/construir_protocolo.py
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTES = RAIZ / 'protocol' / 'fuentes'
DATOS = RAIZ / 'protocol' / 'datos'

DOCS = {
    'TDAH_Etapas_1-7.docx': 'Modelo científico TDAH completo — Etapas 1 a 7 (Etapa 7 modificada)',
    'ETAPA_9_COMPLETA_CORREGIDA_ALINEADA.docx': 'Etapa 9 — Especificación operativa del motor (versión corregida)',
    'AUTOMATIZACION_TDAH_CORREGIDA_COMPLETA.docx': 'Automatización TDAH — fases de la entrevista, esquema e informe (versión corregida)',
}


def texto(docx):
    return subprocess.run(['pandoc', str(FUENTES / docx), '-t', 'plain', '--wrap=none'],
                          capture_output=True, text=True, check=True).stdout


def sha(p):
    return hashlib.sha256((FUENTES / p).read_bytes()).hexdigest()


# --------------------------------------------------------------- Anexo 7 ---
T = texto('TDAH_Etapas_1-7.docx')
AN = T[T.index('ANEXO 7 — PREGUNTAS DE EVALUACIÓN ADAPTATIVA'):]
MARCAS = ['A. PADRES / APODERADOS', 'B. PREGUNTAS QUE LA', 'C. COLEGIO', 'D. NIÑO / NIÑA',
          'E. ADOLESCENTE', 'F. TAMIZAJE MÉDICO', 'G. REGLA OPERATIVA']
POS = [AN.index(m) for m in MARCAS]


def seccion(letra):
    k = 'ABCDEFG'.index(letra)
    s = AN[POS[k]:POS[k + 1]]
    return [(int(m.group(1)), m.group(2).strip()) for m in re.finditer(r'^\s*(\d+)\.\s+(.+)$', s, re.M)]


A, B, C, D, E, F = (dict(seccion(x)) for x in 'ABCDEF')
assert len(A) == 66 and len(B) == 37 and len(C) == 12 and len(D) == 12 and len(E) == 18 and len(F) == 11, 'Anexo 7 cambió'

# Profundización del tamizaje (Anexo 7-F), literal: «X. Nombre: ¿...?, ¿...?»
FSEC = AN[POS[5]:POS[6]]
PROF_F = {}
for m in re.finditer(r'^([A-I])\. ([^:\n]+): (.+)$', FSEC[FSEC.index('Preguntas de profundización'):], re.M):
    qs = [q.strip() for q in re.findall(r'¿[^?]+\?', m.group(3))]
    PROF_F[m.group(1)] = {'nombre': m.group(2).strip(), 'preguntas': [q[0] + q[1].upper() + q[2:] for q in qs]}
assert set(PROF_F) == set('ABCDEFGHI')

# --------------------------------------------------------- alternativas ---
# Etapa 9 §G: presencia/ausencia usa EXACTAMENTE estas cuatro alternativas.
ALT = {
    'presencia': [
        {'codigo': 'A', 'valor': 'si', 'texto': 'Sí'},
        {'codigo': 'B', 'valor': 'no', 'texto': 'No'},
        {'codigo': 'C', 'valor': 'ocasionalmente', 'texto': 'Ocasionalmente'},
        {'codigo': 'D', 'valor': 'no_sabe', 'texto': 'No sabe / No recuerda', 'incierta': True},
    ],
    # D2: categorías justificadas por Etapa 7 §16 (OCASIONALMENTE) y DSM-5-TR («a menudo»).
    'frecuencia': [
        {'codigo': 'A', 'valor': 'varias_al_dia', 'texto': 'Varias veces al día'},
        {'codigo': 'B', 'valor': 'casi_todos_los_dias', 'texto': 'Casi todos los días'},
        {'codigo': 'C', 'valor': 'algunas_por_semana', 'texto': 'Algunas veces por semana'},
        {'codigo': 'D', 'valor': 'ocasionalmente', 'texto': 'Ocasionalmente'},
        {'codigo': 'E', 'valor': 'no_sabe', 'texto': 'No sabe / No recuerda', 'incierta': True},
    ],
    # D3: categorías justificadas por Etapa 4 R3 (≥6 meses) y R4 (antes de los 12 años).
    'desde': [
        {'codigo': 'A', 'valor': 'menos_6_meses', 'texto': 'Hace menos de 6 meses'},
        {'codigo': 'B', 'valor': 'mas_6_meses_antes_12', 'texto': 'Hace más de 6 meses, y comenzó antes de los 12 años'},
        {'codigo': 'C', 'valor': 'mas_6_meses_desde_12', 'texto': 'Hace más de 6 meses, y comenzó a los 12 años o después', 'edad_min': 12},
        {'codigo': 'D', 'valor': 'no_sabe', 'texto': 'No sabe / No recuerda', 'incierta': True},
    ],
    # Etapa 4 R6.1–R6.4 (selección múltiple).
    'contextos': [
        {'codigo': 'A', 'valor': 'hogar', 'texto': 'Hogar'},
        {'codigo': 'B', 'valor': 'colegio', 'texto': 'Colegio'},
        {'codigo': 'C', 'valor': 'social', 'texto': 'Situaciones sociales (con otros niños o adolescentes)'},
        {'codigo': 'D', 'valor': 'otros', 'texto': 'Otros contextos relevantes'},
        {'codigo': 'E', 'valor': 'no_sabe', 'texto': 'No sabe / No recuerda', 'incierta': True, 'excluyente': True},
    ],
    'si_no_ns': [
        {'codigo': 'A', 'valor': 'si', 'texto': 'Sí'},
        {'codigo': 'B', 'valor': 'no', 'texto': 'No'},
        {'codigo': 'C', 'valor': 'no_sabe', 'texto': 'No sabe / No recuerda', 'incierta': True},
    ],
}

# --------------------------------------------------------------- inicio ---
# Brief §3 (orden obligatorio) + Etapa 7 §4 (pregunta abierta de entrada). Ver contradicción K1.
INICIO = [
    {'id': 'INI-MOTIVO', 'objetivo': ['INI', 'motivo'], 'tipo': 'abierta', 'fase': 'F1',
     'texto': '¿Qué está ocurriendo actualmente que motivó esta evaluación?', 'origen': 'Etapa 7 §4; brief §3'},
    {'id': 'INI-EDAD', 'objetivo': ['INI', 'edad'], 'tipo': 'numero', 'fase': 'F1',
     'texto': '¿Qué edad tiene el niño, niña o adolescente evaluado?', 'origen': 'Etapa 7 §3; Anexo 7-G («la edad se registra primero»)'},
    {'id': 'INI-INF-EXISTE', 'objetivo': ['INI', 'informe_existe'], 'tipo': 'opciones', 'alternativas': 'si_no_ns', 'fase': 'F1',
     'texto': '¿Existe un informe escolar sobre el niño, niña o adolescente?', 'origen': 'Etapa 7 §5; brief §3'},
    {'id': 'INI-INF-DISP', 'objetivo': ['INI', 'informe_disponible'], 'tipo': 'opciones', 'alternativas': 'si_no_ns', 'fase': 'F1',
     'condicion': {'objetivo': ['INI', 'informe_existe'], 'igual': 'si'},
     'texto': '¿El informe escolar está disponible o puede obtenerse para esta evaluación?', 'origen': 'Etapa 7 §5.2; brief §3'},
]

# ------------------------------------------------------------ síntomas ---
SINT = {s['codigo']: s['sintoma'] for s in json.load(open(DATOS / 'etapa4_sintomas.json'))}
# Vínculo Anexo 7-A → síntoma DSM-5-TR (Etapa 4 §4–5). R1.4 se cubre con dos preguntas (instrucciones / finalización).
MAP = {'R1.1': [1], 'R1.2': [2], 'R1.3': [3], 'R1.4': [4, 5], 'R1.5': [6], 'R1.6': [7], 'R1.7': [8], 'R1.8': [9], 'R1.9': [10],
       'R2.1': [12], 'R2.2': [11], 'R2.3': [13], 'R2.4': [14], 'R2.5': [15], 'R2.6': [16], 'R2.7': [17], 'R2.8': [18], 'R2.9': [19]}
CLAVES = {  # Detección de menciones (activación inmediata, Etapa 9 §14.2). Sin acentos.
    'R1.1': ['errores por descuido', 'no se fija en los detalles', 'comete errores'],
    'R1.2': ['le cuesta mantener la atencion', 'se desconcentra', 'no se concentra', 'pierde la concentracion', 'le cuesta concentrarse'],
    'R1.3': ['no escucha', 'parece no escuchar', 'no presta atencion cuando le hablan'],
    'R1.4': ['no sigue instrucciones', 'no termina', 'deja las tareas', 'deja todo a medias', 'deja tareas sin terminar'],
    'R1.5': ['desordenado', 'desordenada', 'desorganizado', 'desorganizada', 'no se organiza'],
    'R1.6': ['evita las tareas', 'posterga', 'no quiere hacer tareas', 'evita hacer tareas'],
    'R1.7': ['pierde sus cosas', 'pierde las cosas', 'pierde cosas', 'pierde los utiles', 'pierde sus utiles', 'pierde utiles', 'pierde objetos'],
    'R1.8': ['se distrae', 'distraido', 'distraida', 'en las nubes'],
    'R1.9': ['olvidadizo', 'olvidadiza', 'se le olvida', 'olvida'],
    'R2.1': ['se mueve mucho', 'inquieto', 'inquieta', 'mueve las manos', 'mueve los pies'],
    'R2.2': ['se levanta', 'no se queda sentado', 'no se queda sentada', 'se para en clases'],
    'R2.3': ['corre', 'trepa'],
    'R2.4': ['no juega tranquilo', 'no juega tranquila'],
    'R2.5': ['como un motor', 'no para', 'siempre en movimiento', 'hiperactivo', 'hiperactiva'],
    'R2.6': ['habla mucho', 'habla demasiado', 'habla sin parar'],
    'R2.7': ['responde antes', 'contesta antes'],
    'R2.8': ['no espera su turno', 'no sabe esperar', 'impaciente', 'le cuesta esperar'],
    'R2.9': ['interrumpe', 'se mete en conversaciones'],
}
AREA_SINT = {'R1.1': 'atencion', 'R1.2': 'atencion_sostenida', 'R1.3': 'atencion', 'R1.4': 'mantenimiento_objetivos', 'R1.5': 'organizacion',
             'R1.6': 'regulacion_esfuerzo', 'R1.7': 'organizacion', 'R1.8': 'distractibilidad', 'R1.9': 'memoria_trabajo',
             'R2.1': 'actividad_motora', 'R2.2': 'actividad_motora', 'R2.3': 'actividad_motora', 'R2.4': 'actividad_motora',
             'R2.5': 'actividad_motora', 'R2.6': 'inhibicion', 'R2.7': 'inhibicion', 'R2.8': 'inhibicion', 'R2.9': 'inhibicion'}
SINTOMAS = [{'id': k, 'dominio': 'inatencion' if k.startswith('R1') else 'hiperactividad_impulsividad', 'nombre': SINT[k],
             'preguntas': [f'A{n:02d}' for n in MAP[k]], 'palabras_clave': CLAVES[k], 'area': AREA_SINT[k],
             'origen': 'Etapa 4 §4–5; Anexo 7-A'} for k in sorted(SINT, key=lambda x: (x[:2], int(x.split('.')[1])))]

# Profundización por síntoma (Etapa 9 §14 «máximo 3»; Automatización regla 2; Anexo 7-B 5, 6 y Etapa 9 §10).
PROFUNDIZACION = [
    {'dimension': 'frecuencia', 'tipo': 'opciones', 'alternativas': 'frecuencia', 'base': B[5], 'origen': 'Anexo 7-B 5; Automatización regla 2a'},
    {'dimension': 'desde', 'tipo': 'opciones', 'alternativas': 'desde', 'base': B[6], 'origen': 'Anexo 7-B 6; Etapa 4 R3–R4; Automatización regla 2b'},
    {'dimension': 'contextos', 'tipo': 'multiple', 'alternativas': 'contextos', 'base': '¿Dónde ocurre?', 'origen': 'Etapa 9 §10; Etapa 4 R6'},
]

# ---------------------------------------------------------- banco A ---
def subsec(n):
    if n <= 10: return 'inatencion'
    if n <= 16: return 'hiperactividad'
    if n <= 20: return 'impulsividad'
    if n <= 28: return 'ejecutivas'
    if n <= 37: return 'contexto'
    if n <= 45: return 'trayectoria'
    if n <= 52: return 'impacto'
    if n <= 58: return 'desarrollo'
    return 'alternativas'

SINT_DE = {f'A{n:02d}': k for k, ns in MAP.items() for n in ns}
AREA_A = {20: 'inhibicion', 21: 'planificacion', 22: 'memoria_trabajo', 23: 'mantenimiento_objetivos', 24: 'flexibilidad',
          25: 'flexibilidad', 26: 'persistencia', 27: 'autonomia', 28: 'variabilidad'}
BANCO = []
for n, txt in A.items():
    qid = f'A{n:02d}'
    item = {'id': qid, 'texto': txt, 'seccion': subsec(n), 'tipo': 'abierta' if n == 52 else 'presencia', 'fuente': 'apoderado',
            'origen': f'Anexo 7-A {n}'}
    if qid in SINT_DE:
        item['sintoma'] = SINT_DE[qid]
        item['objetivo'] = [SINT_DE[qid], f'presencia:{qid}']
    else:
        item['objetivo'] = [qid, 'respuesta']
    if n in AREA_A: item['area'] = AREA_A[n]
    BANCO.append(item)

# Bloques de exploración (Etapa 7 §9, §12, §13, §20; Etapa 9 §7). Orden = prioridad; «max» = mínima pregunta suficiente (D4).
BLOQUES = [
    {'id': 'impulsividad_funcional', 'fase': 'F3', 'regla': 'siempre', 'preguntas': ['A20'], 'max': 1,
     'origen': 'Etapa 7 §9 (impulsividad: actuar sin considerar consecuencias)'},
    {'id': 'ejecutivas', 'fase': 'F2', 'regla': 'dominio_positivo:inatencion',
     'preguntas': ['A21', 'A22', 'A23', 'A24', 'A25', 'A27', 'A28', 'A26'], 'max': 5,
     'origen': 'Etapa 7 §9 (organización y funciones ejecutivas); Anexo 7-A 21–28'},
    {'id': 'desarrollo', 'fase': 'F5', 'regla': 'siempre', 'preguntas': ['A53', 'A55', 'A57', 'A58'], 'max': 4,
     'origen': 'Automatización regla 6 (Etapa 5 de la entrevista: anamnesis del desarrollo); Anexo 7-A 53–58'},
    {'id': 'contexto', 'fase': 'F8', 'regla': 'algun_sintoma_positivo',
     'preguntas': ['A37', 'A32', 'A34', 'A31', 'A29', 'A30', 'A33', 'A35', 'A36'], 'max': 5,
     'origen': 'Etapa 7 §12; Etapa 9 §10; Anexo 7-A 29–37'},
    {'id': 'trayectoria', 'fase': 'F8', 'regla': 'algun_sintoma_positivo',
     'preguntas': ['A38', 'A40', 'A41', 'A42', 'A39', 'A43', 'A44', 'A45'], 'max': 5,
     'origen': 'Etapa 7 §7 (requisito obligatorio); Etapa 9 §9; Anexo 7-A 38–45'},
    {'id': 'impacto', 'fase': 'F8', 'regla': 'algun_sintoma_positivo',
     'preguntas': ['A46', 'A47', 'A48', 'A49', 'A50', 'A51', 'A52'], 'max': 7,
     'origen': 'Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52'},
]

# Equivalencias funcionales (Etapa 7 §15; Etapa 9 §B y J.4-A).
EQUIVALENCIAS = [
    {'id': 'EQ-TERMINAR', 'descripcion': 'Dejar sin terminar / mantenerse hasta terminar', 'preguntas': ['A05', 'A26']},
    {'id': 'EQ-SUPERVISION', 'descripcion': 'Más supervisión / más ayuda que otros niños de su edad', 'preguntas': ['A27', 'A50']},
    {'id': 'EQ-SUENO', 'descripcion': 'Dificultades importantes de sueño (cubiertas por el tamizaje, categoría D)', 'preguntas': ['A56', 'TAM:D']},
    {'id': 'EQ-SENSORIAL', 'descripcion': 'Sensibilidad sensorial (cubierta por el tamizaje, categoría H)', 'preguntas': ['A65', 'TAM:H']},
    {'id': 'EQ-MEDICO', 'descripcion': 'Condición médica o medicamento (cubiertos por el tamizaje, categorías E y G)', 'preguntas': ['A66', 'TAM:E', 'TAM:G']},
    {'id': 'EQ-FAMILIAR', 'descripcion': 'Situación familiar o ambiental relevante', 'preguntas': ['A58', 'BAR:K']},
]

# ---------------------------------------------- barrido diferencial (Etapa 9 §H) ---
E9 = texto('ETAPA_9_COMPLETA_CORREGIDA_ALINEADA.docx')
BAR_TXT = re.search(r'Pregunta operativa: “([^”]+)”', E9).group(1)
EMO_TXT = re.search(r'preguntar: “([^”]+)”', E9).group(1)
TAM_TXT = re.search(r'Pregunta inicial de selección múltiple: “([^”]+)”', E9).group(1)
_ib = E9.index('☐ A. Aprendizaje')
bar_ops = re.findall(r'☐ ([A-N])\. ([^\n]+)', E9[_ib:_ib + 2000])
BAR_OPS = []
seen = set()
for c, t in bar_ops:
    if c in seen: continue
    seen.add(c); BAR_OPS.append((c, t.strip()))
assert [c for c, _ in BAR_OPS][:14] == list('ABCDEFGHIJKLMN'), BAR_OPS
BAR_OPS = BAR_OPS[:14]

def preg_aux(id_, texto_, tipo, alternativas=None, origen=''):
    q = {'id': id_, 'texto': texto_, 'tipo': tipo, 'origen': origen}
    if alternativas: q['alternativas'] = alternativas
    return q

TEMP = lambda p: preg_aux(f'{p}-DESDE', B[6], 'opciones', 'desde', 'Anexo 7-B 6')
IMPAC = lambda p: preg_aux(f'{p}-IMPACTO', B[32], 'abierta', None, 'Anexo 7-B 32')
RAMAS_BARRIDO = {
    'A': [preg_aux('BAR-A-1', A[59], 'presencia', None, 'Anexo 7-A 59'), TEMP('BAR-A'), IMPAC('BAR-A')],
    'B': [preg_aux('BAR-B-1', A[60], 'presencia', None, 'Anexo 7-A 60'), TEMP('BAR-B'), IMPAC('BAR-B')],
    'C': [preg_aux('BAR-C-1', A[61], 'presencia', None, 'Anexo 7-A 61'), TEMP('BAR-C')],
    'D': [preg_aux('BAR-D-1', EMO_TXT, 'presencia', None, 'Etapa 9 §H (pregunta de apertura obligatoria)'),
          preg_aux('BAR-D-2', A[62], 'presencia', None, 'Anexo 7-A 62'), TEMP('BAR-D')],
    'E': [preg_aux('BAR-E-1', A[63], 'presencia', None, 'Anexo 7-A 63'), TEMP('BAR-E'), IMPAC('BAR-E')],
    'F': [preg_aux('BAR-F-1', A[54], 'presencia', None, 'Anexo 7-A 54'), preg_aux('BAR-F-2', A[64], 'presencia', None, 'Anexo 7-A 64'), TEMP('BAR-F')],
    'G': [preg_aux('BAR-G-1', A[65], 'presencia', None, 'Anexo 7-A 65'), IMPAC('BAR-G')],
    'H': [], 'I': [],  # audición / visión → tamizaje B / C (Etapa 9 §H.1)
    'J': [preg_aux('BAR-J-1', A[66], 'presencia', None, 'Anexo 7-A 66'), IMPAC('BAR-J')],
    'K': [preg_aux('BAR-K-1', A[58], 'presencia', None, 'Anexo 7-A 58'), TEMP('BAR-K'), IMPAC('BAR-K')],
    'L': [preg_aux('BAR-L-1', PROF_F['I']['preguntas'][0], 'abierta', None, 'Anexo 7-F I')],
}
# Una pregunta de rama con el mismo texto que una pregunta del banco A es la MISMA pregunta (Etapa 9 §B).
TXT_A = {t: f'A{n:02d}' for n, t in A.items()}
for qs in RAMAS_BARRIDO.values():
    for q in qs:
        if q['texto'] in TXT_A: q['equivale_a'] = TXT_A[q['texto']]

BARRIDO = {
    'id': 'BARRIDO', 'texto': BAR_TXT, 'tipo': 'multiple', 'fase': 'F7', 'origen': 'Etapa 9 §H; Automatización regla 3',
    'opciones': [{'codigo': c, 'texto': t, 'valor': c,
                  **({'excluyente': True, 'ninguna': True} if c == 'M' else {}),
                  **({'excluyente': True, 'incierta': True} if c == 'N' else {}),
                  **({'deriva_tamizaje': {'H': 'B', 'I': 'C', 'C': 'D', 'J': 'E'}[c]} if c in 'HICJ' else {})}
                 for c, t in BAR_OPS],
    'ramas': RAMAS_BARRIDO,
}

# ------------------------------------------- tamizaje médico/sensorial/sueño (Etapa 9 §H.1) ---
tam_ops = re.findall(r'^([A-K])\. ([^\n]+)$', E9[E9.index(TAM_TXT):E9.index('REGLAS OPERATIVAS DEL MÓDULO')], re.M)
assert [c for c, _ in tam_ops] == list('ABCDEFGHIJK'), tam_ops
# Prioridad de profundización (máx. 3 por categoría, D5) y tipo de respuesta de cada pregunta del Anexo 7-F.
PRIO_F = {'A': [0, 2, 4], 'B': [0, 1, 2], 'C': [0, 1, 3], 'D': [0, 2, 4], 'E': [0, 2, 3], 'F': [0, 1, 2], 'G': [0, 1, 2], 'H': [0, 2, 3], 'I': [0]}
TIPO_F = {('A', 2): ('opciones', 'frecuencia'), ('A', 4): ('opciones', 'si_no_ns'), ('B', 1): ('opciones', 'si_no_ns'), ('B', 2): ('opciones', 'si_no_ns'),
          ('C', 1): ('opciones', 'si_no_ns'), ('C', 3): ('opciones', 'si_no_ns'), ('D', 2): ('opciones', 'si_no_ns'), ('D', 4): ('opciones', 'si_no_ns'),
          ('E', 2): ('opciones', 'si_no_ns'), ('E', 3): ('opciones', 'si_no_ns'), ('F', 1): ('opciones', 'si_no_ns'), ('F', 2): ('opciones', 'si_no_ns'),
          ('G', 2): ('opciones', 'si_no_ns')}
ALERTA = {('D', 2): 'si'}  # pausas respiratorias → valoración sanitaria (Etapa 7 §14.1; Etapa 9 §H.1-9)
TAM_CAT = {}
for c in 'ABCDEFGHI':
    qs = []
    for i in PRIO_F[c]:
        tipo, alt = TIPO_F.get((c, i), ('abierta', None))
        q = preg_aux(f'TAM-{c}-{i + 1}', PROF_F[c]['preguntas'][i], tipo, alt, f'Anexo 7-F {c} (pregunta {i + 1})')
        if (c, i) in ALERTA: q['alerta_si'] = ALERTA[(c, i)]
        if c == 'D' and i == 4 or c == 'A' and i == 4: q['evaluado_profesional'] = True
        qs.append(q)
    TAM_CAT[c] = {'nombre': PROF_F[c]['nombre'], 'preguntas': qs,
                  'alerta_sanitaria': c == 'A',  # episodios de desconexión: revisión profesional (Etapa 7 §14.1)
                  'nota': 'El sistema no debe recomendar suspender ni modificar medicación.' if c == 'G' else None}
TAMIZAJE = {
    'id': 'TAMIZAJE', 'texto': TAM_TXT, 'tipo': 'multiple', 'fase': 'F6', 'origen': 'Etapa 7 §14.1; Anexo 7-F; Etapa 9 §H.1 y J.6.1',
    'opciones': [{'codigo': c, 'texto': t.replace(' (opción excluyente)', ''), 'valor': c,
                  **({'excluyente': True, 'ninguna': True} if c == 'J' else {}),
                  **({'excluyente': True, 'incierta': True} if c == 'K' else {})} for c, t in tam_ops],
    'categorias': TAM_CAT,
    'estados': ['NO_REALIZADO', 'EN_CURSO', 'COMPLETADO', 'COMPLETADO_CON_INCERTIDUMBRE', 'CUBIERTO_POR_FUENTE'],
    'resultados': ['EXPLORADO_SIN_DIFICULTADES_REPORTADAS', 'HALLAZGOS_REPORTADOS', 'INCERTIDUMBRE', 'NO_APLICA', 'NO_DETERMINADO'],
}

# ---------------------------------- otras fuentes (Etapa 7 §17; Anexo 7-C, D, E) ---
COLEGIO = [{'id': f'C{n:02d}', 'texto': t, 'tipo': 'abierta', 'fuente': 'profesor', 'origen': f'Anexo 7-C {n}'} for n, t in C.items()]
# Cobertura por el informe escolar: qué tipo de dato extraído responde cada pregunta C (D6).
COBERTURA_C = {'C01': 'algun_sintoma', 'C02': 'desde', 'C03': 'contextos', 'C07': 'algun_sintoma', 'C08': 'impacto_academico'}
for q in COLEGIO:
    if q['id'] in COBERTURA_C: q['cubierta_por'] = COBERTURA_C[q['id']]
# Ruta A: el apoderado aporta lo que sepa del colegio (Etapa 7 §5.1) — D7.
RUTA_A = [{'id': f'RA-{q["id"]}', 'texto': 'Según lo que usted sabe del colegio: ' + q['texto'][0].lower() + q['texto'][1:],
           'tipo': 'abierta', 'fuente': 'apoderado', 'base': q['id'], 'origen': f'Etapa 7 §5.1; Anexo 7-C {q["id"][1:]}'}
          for q in COLEGIO if q['id'] in ('C01', 'C03', 'C04', 'C08')]
NINO = [{'id': f'D{n:02d}', 'texto': t, 'tipo': 'abierta', 'fuente': 'nino', 'origen': f'Anexo 7-D {n}'} for n, t in D.items()]
ADOL = [{'id': f'E{n:02d}', 'texto': t, 'tipo': 'abierta', 'fuente': 'adolescente', 'origen': f'Anexo 7-E {n}'} for n, t in E.items()]

# ------------------------------------------------- integración / informe ---
TRAY = json.load(open(DATOS / 'etapa2_trayectoria.json'))
PERFILES = json.load(open(DATOS / 'etapa1_perfiles.json'))
ETAPA_EDAD = [{'desde': 2, 'hasta': 3, 'etapa': '2–3 años'}, {'desde': 4, 'hasta': 5, 'etapa': '4–5 años'}, {'desde': 6, 'hasta': 7, 'etapa': '6–7 años'},
              {'desde': 8, 'hasta': 10, 'etapa': '8–10 años'}, {'desde': 11, 'hasta': 13, 'etapa': '11–13 años'}, {'desde': 14, 'hasta': 17, 'etapa': '14–17 años'}]

# Áreas funcionales (Etapa 5 §26 y §33; Etapa 9 §19.4 y §20.3). «dominio_e2» = fila de la matriz de la Etapa 2.
def sistemas(clave):
    m = re.search(re.escape(clave) + r' → ([^\n]+)', E9)
    return m.group(1).strip() if m else None

AREAS = [
    {'id': 'atencion', 'nombre': 'Atención', 'dominio_e2': 'Atención', 'sistemas': sistemas('Atención sostenida y control atencional')},
    {'id': 'atencion_sostenida', 'nombre': 'Atención sostenida', 'dominio_e2': 'Atención sostenida', 'sistemas': sistemas('Atención sostenida y control atencional')},
    {'id': 'distractibilidad', 'nombre': 'Distractibilidad / selección de información', 'dominio_e2': 'Distractibilidad', 'sistemas': sistemas('Atención sostenida y control atencional')},
    {'id': 'inhibicion', 'nombre': 'Inhibición y control de respuesta', 'dominio_e2': 'Inhibición', 'sistemas': sistemas('Inhibición y control de respuesta')},
    {'id': 'memoria_trabajo', 'nombre': 'Memoria de trabajo', 'dominio_e2': 'Memoria de trabajo', 'sistemas': sistemas('Memoria de trabajo')},
    {'id': 'mantenimiento_objetivos', 'nombre': 'Mantenimiento de objetivos', 'dominio_e2': 'Mantenimiento de objetivos', 'sistemas': sistemas('Memoria de trabajo')},
    {'id': 'planificacion', 'nombre': 'Planificación', 'dominio_e2': 'Planificación', 'sistemas': sistemas('Planificación y organización')},
    {'id': 'organizacion', 'nombre': 'Organización', 'dominio_e2': 'Organización', 'sistemas': sistemas('Planificación y organización')},
    {'id': 'flexibilidad', 'nombre': 'Flexibilidad cognitiva', 'dominio_e2': 'Flexibilidad cognitiva', 'sistemas': sistemas('Flexibilidad cognitiva')},
    {'id': 'persistencia', 'nombre': 'Persistencia', 'dominio_e2': 'Persistencia', 'sistemas': sistemas('Recompensa/demora y motivación')},
    {'id': 'regulacion_esfuerzo', 'nombre': 'Regulación del esfuerzo', 'dominio_e2': 'Regulación del esfuerzo', 'sistemas': sistemas('Recompensa/demora y motivación')},
    {'id': 'variabilidad', 'nombre': 'Variabilidad del desempeño', 'dominio_e2': 'Variabilidad del desempeño', 'sistemas': sistemas('Variabilidad del desempeño')},
    {'id': 'actividad_motora', 'nombre': 'Actividad motora', 'dominio_e2': 'Actividad motora', 'sistemas': sistemas('Actividad motora')},
    {'id': 'autonomia', 'nombre': 'Autonomía', 'dominio_e2': 'Autonomía', 'sistemas': None},
]
for a in AREAS:
    fila = next((d for d in TRAY['dominios'] if d['dominio'] == a['dominio_e2']), None)
    assert fila, a
    a['esperable_por_etapa'] = fila['por_etapa']; a['respaldo'] = fila['respaldo']

# Sugerencias de acción (Etapa 9 §21) y referencias (Etapa 9, sección final).
def parrafo(num):
    m = re.search(rf'^{re.escape(num)}[^\n]*\n\n([^\n]+)', E9, re.M)
    return m.group(1).strip()
SUGERENCIAS = [
    {'id': 'organizacion', 'areas': ['organizacion', 'planificacion'], 'texto': parrafo('21.4 Organización'), 'refs': [6], 'origen': 'Etapa 9 §21.4'},
    {'id': 'familia', 'areas': ['inhibicion', 'actividad_motora', 'autonomia'], 'texto': parrafo('21.5 Familia y conducta'), 'refs': [7], 'origen': 'Etapa 9 §21.5'},
    {'id': 'escolar', 'areas': ['atencion', 'atencion_sostenida', 'distractibilidad', 'mantenimiento_objetivos'], 'texto': parrafo('21.6 Contexto escolar'), 'refs': [1, 2], 'origen': 'Etapa 9 §21.6'},
    {'id': 'sueno', 'tamizaje': 'D', 'texto': parrafo('21.7 Sueño'), 'refs': [8, 9], 'origen': 'Etapa 9 §21.7'},
    {'id': 'actividad_fisica', 'areas': ['actividad_motora', 'inhibicion', 'memoria_trabajo'], 'texto': parrafo('21.8 Actividad física'), 'refs': [10], 'origen': 'Etapa 9 §21.8'},
    {'id': 'fortalezas', 'recursos': True, 'texto': parrafo('21.9 Fortalezas como punto de intervención'), 'refs': [], 'origen': 'Etapa 9 §21.9'},
    {'id': 'medicas', 'siempre': True, 'texto': parrafo('21.12 Intervenciones médicas'), 'refs': [1, 2], 'origen': 'Etapa 9 §21.12'},
]
REFS = {int(m.group(1)): m.group(2).strip() for m in re.finditer(r'^\[(\d+)\] (.+)$', E9, re.M)}
assert len(REFS) == 10

PROTOCOLO = {
    'id': 'tdah-protocolo',
    'version': '1.0.0',
    'estado': 'VIGENTE',
    'aviso': 'Protocolo codificado desde los documentos vigentes del proyecto (Etapas 1–7, Etapa 9 corregida y Automatización corregida). El resultado es una hipótesis estructurada sujeta a revisión y decisión del profesional responsable.',
    'fuentes': [{'archivo': k, 'titulo': v, 'sha256': sha(k)} for k, v in DOCS.items()],
    'parametros': {
        'umbral_sintomas': {'menor_17': 6, 'desde_17': 5, 'origen': 'Etapa 4 §3'},
        'varios_minimo': 2, 'varios_origen': 'D8 (DSM-5-TR «varios» no cuantifica; parámetro a confirmar por el equipo clínico)',
        'max_profundizacion_sintoma': 3, 'max_origen': 'Etapa 9 §14 y D.1; Automatización regla 2',
        'umbral_similitud_textual': 0.6,
    },
    'alternativas': ALT,
    'fases': [
        {'id': 'F1', 'nombre': 'Triaje e identificación inicial'},
        {'id': 'F2', 'nombre': 'Inatención y funciones ejecutivas en el hogar'},
        {'id': 'F3', 'nombre': 'Hiperactividad e impulsividad en el hogar'},
        {'id': 'F4', 'nombre': 'Integración del contexto escolar previo'},
        {'id': 'F5', 'nombre': 'Anamnesis del desarrollo'},
        {'id': 'F8', 'nombre': 'Triangulación y concordancia multicontextual (contexto, trayectoria, impacto)'},
        {'id': 'F7', 'nombre': 'Barrido diferencial (incluye exclusión emocional y afectiva)'},
        {'id': 'F6', 'nombre': 'Tamizaje médico, sensorial y del sueño'},
        {'id': 'F9', 'nombre': 'Integración sintética y salida diagnóstica'},
    ],
    'fases_origen': 'Automatización regla 6 (9 etapas de la entrevista); orden F7→F6 según Etapa 9 §J.5 (ver K6)',
    'inicio': INICIO,
    'sintomas': SINTOMAS,
    'profundizacion_sintoma': PROFUNDIZACION,
    'banco': BANCO,
    'banco_profundizacion': [{'id': f'B{n:02d}', 'texto': t} for n, t in B.items()],
    'bloques': BLOQUES,
    'equivalencias': EQUIVALENCIAS,
    'barrido': BARRIDO,
    'tamizaje': TAMIZAJE,
    'ruta_a_escolar': RUTA_A,
    'colegio': COLEGIO,
    'nino': NINO,
    'adolescente': ADOL,
    'etapas_edad': ETAPA_EDAD,
    'trayectoria_etapa2': TRAY,
    'perfiles': PERFILES,
    'areas': AREAS,
    'sugerencias': SUGERENCIAS,
    'referencias': REFS,
    'instrumentos': [
        {'id': 'RV', 'nombre': 'Realidad virtual del proyecto (evidencia objetiva complementaria)', 'obligatorio': False, 'objetivo': True},
        {'id': 'NESPLORA', 'nombre': 'Nesplora (evidencia objetiva complementaria)', 'obligatorio': False, 'objetivo': True},
        {'id': 'ESCALA-APODERADO', 'nombre': 'Escala o cuestionario — apoderado', 'obligatorio': False},
        {'id': 'ESCALA-DOCENTE', 'nombre': 'Escala o cuestionario — docente', 'obligatorio': False},
        {'id': 'NEUROPSICOLOGICA', 'nombre': 'Evaluación neuropsicológica', 'obligatorio': False},
        {'id': 'OTRO', 'nombre': 'Otro instrumento o documento clínico', 'obligatorio': False},
    ],
    'instrumentos_origen': 'Ningún documento vigente define instrumentos obligatorios (Etapa 8 — RV — no entregada): todos opcionales, D9',
    'requisitos_informe_final': ['fase_inicial_completa', 'entrevista_apoderado_cerrada', 'informe_escolar_segun_ruta',
                                 'contradicciones_revisadas', 'decision_profesional'],
}

salida = RAIZ / 'protocol' / 'protocolo.json'
# Redacción operativa: algunos párrafos de los documentos fuente se reescriben según
# protocol/datos/redaccion.json (el sistema ejecuta las reglas con software determinista).
REEMPLAZOS = json.loads((RAIZ / 'protocol' / 'datos' / 'redaccion.json').read_text(encoding='utf-8'))['reemplazos']
def operativo(v):
    if isinstance(v, str):
        for a, b in REEMPLAZOS: v = v.replace(a, b)
        return v
    if isinstance(v, list): return [operativo(x) for x in v]
    if isinstance(v, dict): return {k: (x if k in ('archivo', 'sha256') else operativo(x)) for k, x in v.items()}
    return v
PROTOCOLO = operativo(PROTOCOLO)
salida.write_text(json.dumps(PROTOCOLO, ensure_ascii=False, indent=1))
print(f'{salida.relative_to(RAIZ)}: {len(BANCO)} preguntas A, {len(SINTOMAS)} síntomas, {len(BARRIDO["opciones"])} áreas de barrido, '
      f'{sum(len(c["preguntas"]) for c in TAM_CAT.values())} preguntas de tamizaje, {len(COLEGIO)} C, {len(NINO)} D, {len(ADOL)} E')
