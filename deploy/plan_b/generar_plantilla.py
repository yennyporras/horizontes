# Genera deploy/plan_b/Plantilla_Horizontes_Shot_Nutresa.xlsx desde data/seed_foodsume.json (plan B sin la app).
# Uso: python deploy/plan_b/generar_plantilla.py   (requiere openpyxl)
# Hojas: Instrucciones · Votos (una fila por papeleta) · Resultados (promedios por criterio y motor con los pesos de la semilla) · Matriz.
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BubbleChart, Reference, Series
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

RAIZ = Path(__file__).resolve().parents[2]
SEMILLA = json.loads((RAIZ / 'data/seed_foodsume.json').read_text(encoding='utf8'))
SALIDA = Path(__file__).with_name('Plantilla_Horizontes_Shot_Nutresa.xlsx')

AZUL = '1C4587'
CAB = PatternFill('solid', fgColor=AZUL)
SUAVE = PatternFill('solid', fgColor='EAF2FB')
BLANCO = Font(color='FFFFFF', bold=True, name='Montserrat')
NEGRITA = Font(bold=True, name='Montserrat')
NORMAL = Font(name='Montserrat')

motor = SEMILLA['motor']
pesos = motor['pesos']
criterios = [c['id'] for c in motor['criterios']]
nombres = {c['id']: c['nombre'] for c in motor['criterios']}
proyectos = SEMILLA['plantilla']['proyectos']
vivos = [p for p in proyectos if p['modo'] == 'vivo']
fijos = [p for p in proyectos if p['modo'] == 'fijo']
FILAS_VOTOS = int(__import__('os').environ.get('FILAS_VOTOS', 600))

wb = Workbook()

# --- Instrucciones -------------------------------------------------------------------
ins = wb.active
ins.title = 'Instrucciones'
texto = [
    ('Plan B · Taller Horizontes (caso Foodsume)', NEGRITA),
    ('Úsalo solo si la app no está disponible. Mismo cálculo que la app: promedio simple por criterio y los pesos de la semilla.', NORMAL),
    ('', NORMAL),
    ('1. Cada persona llena una papeleta por ronda (papeleta.html, impresa) con los 2 proyectos y los 6 criterios.', NORMAL),
    ('2. Digita cada papeleta en la hoja Votos: mesa, ronda, proyecto y los 6 valores (solo 1, 3, 5, 7 o 9). Una fila por proyecto.', NORMAL),
    ('3. En Resultados escribe en C2 "Sala" o el número de la mesa. Los promedios y los ejes se calculan solos.', NORMAL),
    ('4. La hoja Matriz muestra los 8 fijos y los 2 vivos en R1 y R2. Proyéctala.', NORMAL),
    ('', NORMAL),
    ('Si ya tienes los promedios por criterio (por ejemplo, contados a mano), escríbelos en Resultados, filas "Promedio digitado", y deja vacía la hoja Votos.', NORMAL),
    ('Nunca escribas nombres en la hoja Votos: la papeleta es anónima.', NORMAL),
]
for i, (t, f) in enumerate(texto, 1):
    ins.cell(i, 1, t).font = f
ins.column_dimensions['A'].width = 130

# --- Votos ---------------------------------------------------------------------------
vo = wb.create_sheet('Votos')
cab = ['Mesa', 'Ronda', 'Proyecto'] + [nombres[c] for c in criterios]
for j, t in enumerate(cab, 1):
    c = vo.cell(1, j, t)
    c.fill, c.font, c.alignment = CAB, BLANCO, Alignment(wrap_text=True, vertical='center')
    vo.column_dimensions[c.column_letter].width = 8 if j <= 2 else (14 if j == 3 else 18)
vo.row_dimensions[1].height = 48
vo.freeze_panes = 'A2'
dv_ronda = DataValidation(type='list', formula1='"1,2"', allow_blank=True)
dv_proy = DataValidation(type='list', formula1='"' + ','.join(p['nombre'] for p in vivos) + '"', allow_blank=True)
dv_val = DataValidation(type='list', formula1='"1,3,5,7,9"', allow_blank=True, error='Solo 1, 3, 5, 7 o 9', showErrorMessage=True)
dv_mesa = DataValidation(type='whole', operator='between', formula1='1', formula2='50', allow_blank=True)
for dv in (dv_ronda, dv_proy, dv_val, dv_mesa):
    vo.add_data_validation(dv)
dv_mesa.add(f'A2:A{FILAS_VOTOS + 1}')
dv_ronda.add(f'B2:B{FILAS_VOTOS + 1}')
dv_proy.add(f'C2:C{FILAS_VOTOS + 1}')
dv_val.add(f'D2:I{FILAS_VOTOS + 1}')

# --- Resultados ----------------------------------------------------------------------
re_ = wb.create_sheet('Resultados')
re_['A1'] = 'Resultados por ronda'; re_['A1'].font = Font(bold=True, size=14, name='Montserrat', color=AZUL)
re_['A2'] = 'Alcance (Sala o número de mesa):'; re_['A2'].font = NEGRITA
re_['C2'] = 'Sala'; re_['C2'].fill = SUAVE; re_['C2'].font = NEGRITA
# Pesos (de la semilla, editables solo si cambia la semilla)
re_['A4'] = 'Pesos'; re_['A4'].font = NEGRITA
filas_peso = [
    ('T2M · alistamiento técnico', pesos['t2m']['alistamiento_tecnico']),
    ('T2M · conocimiento del cliente', pesos['t2m']['conocimiento_cliente']),
    ('T2M · regulación', pesos['t2m']['regulacion']),
    ('Eje X · T2M', pesos['eje_x']['t2m']),
    ('Eje X · capacidades organizacionales', pesos['eje_x']['capacidades_organizacionales']),
    ('Eje Y · alineación con el core', pesos['eje_y']['alineacion_core']),
    ('Eje Y · inversión requerida', pesos['eje_y']['inversion_requerida']),
]
for i, (t, v) in enumerate(filas_peso):
    re_.cell(5 + i, 1, t).font = NORMAL
    re_.cell(5 + i, 3, v).font = NORMAL
P = {k: f'$C${5 + i}' for i, k in enumerate(['at', 'cc', 'rg', 'x_t2m', 'x_cap', 'y_core', 'y_inv'])}

# Tabla de vivos: una fila por (ronda, proyecto). Columnas: Ronda, Proyecto, n, 6 criterios, T2M, Eje X, Eje Y, TAM
F0 = 14
cab = ['Ronda', 'Proyecto', 'N.º votos'] + [nombres[c] for c in criterios] + ['T2M', 'Eje X', 'Eje Y', 'TAM']
re_.cell(F0 - 1, 1, 'Proyectos vivos (calculado desde la hoja Votos; si no hay votos, se usa el promedio digitado)').font = NEGRITA
for j, t in enumerate(cab, 1):
    c = re_.cell(F0, j, t)
    c.fill, c.font, c.alignment = CAB, BLANCO, Alignment(wrap_text=True, vertical='center')
re_.row_dimensions[F0].height = 60
letras = 'DEFGHI'
col_crit = dict(zip(criterios, letras))
fila = F0 + 1
filas_vivos = {}
DIG0 = F0 + 8  # filas de promedio digitado
re_.cell(DIG0 - 1, 1, 'Promedio digitado (solo si no usas la hoja Votos)').font = NEGRITA
for ronda in (1, 2):
    for p in vivos:
        n_dig = DIG0 + len(filas_vivos)
        re_.cell(n_dig, 1, ronda); re_.cell(n_dig, 2, p['nombre'])
        for col in letras:
            re_[f'{col}{n_dig}'].fill = SUAVE
        filtro_mesa = 'IF(OR($C$2="Sala",$C$2=""),"<>",$C$2)'
        rg = lambda L: f'Votos!${L}$2:${L}${FILAS_VOTOS + 1}'
        cond = f'{rg("B")},{ronda},{rg("C")},"{p["nombre"]}",{rg("A")},{filtro_mesa}'
        re_.cell(fila, 1, ronda); re_.cell(fila, 2, p['nombre']).font = NEGRITA
        re_.cell(fila, 3, f'=COUNTIFS({cond})')
        for k, col in col_crit.items():
            vcol = 'DEFGHI'[criterios.index(k)]
            re_[f'{col}{fila}'] = f'=IF(C{fila}>0,AVERAGEIFS({rg(vcol)},{cond}),IF({col}{n_dig}="","",{col}{n_dig}))'
            re_[f'{col}{fila}'].number_format = '0.00'
        a, c, r = (f'{col_crit[k]}{fila}' for k in ('alistamiento_tecnico', 'conocimiento_cliente', 'regulacion'))
        cap, core, inv = (f'{col_crit[k]}{fila}' for k in ('capacidades_organizacionales', 'alineacion_core', 'inversion_requerida'))
        re_[f'J{fila}'] = f'=IF(COUNT({a},{c},{r})<3,NA(),{a}*{P["at"]}+{c}*{P["cc"]}+{r}*{P["rg"]})'
        re_[f'K{fila}'] = f'=IF(OR(ISNA(J{fila}),{cap}=""),NA(),J{fila}*{P["x_t2m"]}+{cap}*{P["x_cap"]})'
        re_[f'L{fila}'] = f'=IF(OR({core}="",{inv}=""),NA(),{core}*{P["y_core"]}+{inv}*{P["y_inv"]})'
        re_[f'M{fila}'] = p['tam']
        for col in 'JKL':
            re_[f'{col}{fila}'].number_format = '0.00'
        filas_vivos[(ronda, p['id'])] = fila
        fila += 1

# Tabla de fijos (inputs de la semilla)
FF = DIG0 + 6
re_.cell(FF - 1, 1, 'Proyectos fijos (calificación precargada de la semilla, no se votan)').font = NEGRITA
cab = ['', 'Proyecto', ''] + [nombres[c] for c in criterios] + ['T2M', 'Eje X', 'Eje Y', 'TAM']
for j, t in enumerate(cab, 1):
    c = re_.cell(FF, j, t)
    c.fill, c.font, c.alignment = CAB, BLANCO, Alignment(wrap_text=True, vertical='center')
re_.row_dimensions[FF].height = 60
for i, p in enumerate(fijos):
    f = FF + 1 + i
    re_.cell(f, 2, p['nombre'])
    for k, col in col_crit.items():
        re_[f'{col}{f}'] = p['inputs'][k]
    a, c, r = (f'{col_crit[k]}{f}' for k in ('alistamiento_tecnico', 'conocimiento_cliente', 'regulacion'))
    cap, core, inv = (f'{col_crit[k]}{f}' for k in ('capacidades_organizacionales', 'alineacion_core', 'inversion_requerida'))
    re_[f'J{f}'] = f'={a}*{P["at"]}+{c}*{P["cc"]}+{r}*{P["rg"]}'
    re_[f'K{f}'] = f'=J{f}*{P["x_t2m"]}+{cap}*{P["x_cap"]}'
    re_[f'L{f}'] = f'={core}*{P["y_core"]}+{inv}*{P["y_inv"]}'
    re_[f'M{f}'] = p['tam']
    for col in 'JKL':
        re_[f'{col}{f}'].number_format = '0.00'
re_.column_dimensions['A'].width = 9
re_.column_dimensions['B'].width = 16
for col in 'CDEFGHIJKLM':
    re_.column_dimensions[col].width = 15

# --- Matriz --------------------------------------------------------------------------
ma = wb.create_sheet('Matriz')
ma['A1'] = motor['grafico']['titulo']; ma['A1'].font = Font(bold=True, size=14, name='Montserrat', color=AZUL)
ch = BubbleChart()
ch.style = 18
ch.title = None
ch.height, ch.width = 16, 24
ch.x_axis.title = motor['ejes']['x']['titulo']
ch.y_axis.title = motor['ejes']['y']['titulo']
for eje in (ch.x_axis, ch.y_axis):
    eje.scaling.min, eje.scaling.max, eje.majorUnit = 0, 9.5, 1
    eje.delete = False
ch.bubbleScale = 40

def serie(nombre, filas):
    s = Series(values=Reference(re_, min_col=12, min_row=filas[0], max_row=filas[-1]),
               xvalues=Reference(re_, min_col=11, min_row=filas[0], max_row=filas[-1]),
               zvalues=Reference(re_, min_col=13, min_row=filas[0], max_row=filas[-1]), title=nombre)
    return s

ch.series.append(serie('Fijos', [FF + 1, FF + len(fijos)]))
for p in vivos:
    for ronda in (1, 2):
        f = filas_vivos[(ronda, p['id'])]
        ch.series.append(serie(f'{p["nombre"]} R{ronda}', [f, f]))
ma.add_chart(ch, 'A3')
ma['A36'] = 'Fijos en gris; cada vivo aparece en R1 y R2. Tamaño de la burbuja: TAM. Horizontes: H1 hasta radio 4,5; H2 hasta 9; H3 afuera.'
ma['A36'].font = NORMAL

wb.save(SALIDA)
print('ok', SALIDA)

# --- Papeleta imprimible (A4, una por persona y ronda) -----------------------------------
from html import escape

filas = []
for c in motor['criterios']:
    rub = ''.join(f'<li><b>{r["valor"]}</b> {escape(r["texto"])}</li>' for r in c['rubrica'])
    opciones = ''.join(f'<span class="op">{v}</span>' for v in motor['escala_permitida'])
    filas.append(f'<tr><td><b>{escape(c["nombre"])}</b><div class="preg">{escape(c["pregunta"])}</div><ul>{rub}</ul></td>'
                 + ''.join(f'<td class="marca">{opciones}</td>' for _ in vivos) + '</tr>')
papeleta = f'''<!doctype html><html lang="es"><meta charset="utf-8"><title>Papeleta · Taller Horizontes</title>
<style>
@page {{ size: A4; margin: 10mm; }}
body {{ font-family: Montserrat, Arial, sans-serif; color: #0F2340; font-size: 9pt; margin: 0; }}
h1 {{ color: #{AZUL}; font-size: 15pt; margin: 0 0 2mm; }}
.datos {{ display: flex; gap: 8mm; margin: 2mm 0 3mm; font-size: 11pt; }}
.datos span {{ border-bottom: 1px solid #0F2340; min-width: 30mm; display: inline-block; }}
table {{ border-collapse: collapse; width: 100%; }}
th {{ background: #{AZUL}; color: #fff; padding: 2mm; font-size: 11pt; }}
td {{ border: 1px solid #9FB3CF; padding: 1mm 2mm; vertical-align: top; }}
.preg {{ font-style: italic; margin: 1mm 0; }}
ul {{ margin: 0; padding-left: 4mm; list-style: none; font-size: 7.5pt; }}
.marca {{ text-align: center; vertical-align: middle; white-space: nowrap; width: 32mm; }}
.op {{ display: inline-block; width: 6mm; height: 6mm; line-height: 6mm; border: 1.2px solid #{AZUL}; border-radius: 50%; margin: 0.6mm; font-weight: 700; }}
.pie {{ font-size: 8.5pt; margin-top: 2mm; }}
</style>
<h1>Taller Horizontes · Papeleta de calificación</h1>
<div class="datos">Mesa: <span></span> Ronda: <span>&nbsp;1&nbsp;&nbsp;&nbsp;2</span> Perfil: <span style="min-width:50mm"></span></div>
<p>Encierra un solo valor por criterio para cada proyecto. Las 6 preguntas son obligatorias. No escribas tu nombre: la papeleta es anónima.</p>
<table><thead><tr><th>Criterio y rúbrica</th>{''.join(f'<th>{escape(p["nombre"])}</th>' for p in vivos)}</tr></thead>
<tbody>{''.join(filas)}</tbody></table>
<p class="pie">Entrega la papeleta al facilitador. Se digita en la plantilla del plan B y se calcula igual que en la app.</p>
</html>
'''
Path(__file__).with_name('papeleta.html').write_text(papeleta, encoding='utf8')
print('ok papeleta.html')
