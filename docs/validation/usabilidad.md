# Prueba de usabilidad moderada

> Tarea: T-11 ([#34](https://github.com/raztor/farmacias/issues/34)) · Objetivo: OE-06 · Riesgo: R-06 · Indicador del Inception §3.4: **«al menos 80 % de participantes completa búsqueda, pedido y seguimiento sin ayuda»** · Historias evaluadas: HU-01..HU-05, HU-09 · App: web de la app Expo (teléfono o computador)

## Estado

**Kit listo; las sesiones están pendientes.** Las sesiones requieren participantes reales y las ejecuta el equipo. Los resultados se registran en la sección [Resultados](#10-resultados) y en [#34](https://github.com/raztor/farmacias/issues/34). Ninguna cifra de este documento debe completarse sin una sesión realizada.

| Paso                                                                       | Responsable   | Fecha         | Estado |
| -------------------------------------------------------------------------- | ------------- | ------------- | ------ |
| Reclutar participantes (§3) y agendar las sesiones                         | `[completar]` | `[completar]` | ⏳     |
| Sesión piloto con alguien del equipo o cercano (no cuenta en el resultado) | `[completar]` | `[completar]` | ⏳     |
| Sesiones P01..P0n                                                          | `[completar]` | `[completar]` | ⏳     |
| Consolidar resultados (§10) y crear issues de hallazgos (§11)              | `[completar]` | `[completar]` | ⏳     |
| Presentar resultados al PO en la Sprint 2 Review                           | `[completar]` | `[completar]` | ⏳     |

## 1. Objetivos

1. Medir si las personas completan **sin ayuda** las tareas críticas del MVP: buscar un medicamento, armar y pagar un pedido (simulado) y consultar su seguimiento (indicador §3.4, meta ≥ 80 %).
2. Detectar los problemas que impiden o retrasan esas tareas, en especial para **personas adultas mayores y cuidadores** (R-06, Inception §2.3).
3. Comprobar que los textos se entienden: disponibilidad («Quedan pocas»), modalidad (retiro / despacho simulado), resultado del pago y nombres de los estados del pedido (RNF-09).
4. Obtener una medida de satisfacción comparable entre iteraciones (SUS).

Preguntas que la prueba debe responder:

- ¿Encuentran un medicamento por principio activo aunque no lo escriban exacto?
- ¿Entienden que el pago es simulado y qué pasó cuando fue rechazado?
- ¿Saben dónde ver su pedido y entienden en qué estado está y qué sigue?
- ¿Qué pantalla o texto genera más dudas o errores?

## 2. Formato

| Aspecto     | Definición                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipo        | Moderada, una persona a la vez, protocolo de pensamiento en voz alta                                                                                                               |
| Duración    | 35–45 minutos por sesión (5 de introducción y consentimiento, 20–25 de tareas, 5 de SUS, 5 de preguntas finales)                                                                   |
| Modalidad   | Presencial (preferida para adultos mayores) o remota con pantalla compartida                                                                                                       |
| Dispositivo | El que la persona usa habitualmente: teléfono (navegador del teléfono con la web de la app) o computador. Registrar cuál                                                           |
| Roles       | **Moderador** (lee los escenarios, conduce y no ayuda salvo según §8) y **registrador** (toma tiempos, cuenta errores, anota citas y avanza el pedido en el admin para la tarea 5) |
| Entorno     | Stack de demostración con el seed sintético (`docs/DEPLOYMENT.md`) o `pnpm --filter @repo/e2e e2e:stack`. Nunca producción ni datos reales                                         |
| Grabación   | Solo audio y pantalla, y solo con consentimiento explícito. No grabar el rostro                                                                                                    |

## 3. Participantes

**Cantidad:** mínimo 5 y recomendado 8. Con 5 personas se detecta la mayoría de los problemas graves; con 8 la tasa de éxito es algo más estable (con 5, cada persona equivale a 20 puntos porcentuales). En el informe se reporta el número exacto, por ejemplo «7 de 8», y no solo el porcentaje.

**Perfil** (Inception §2.2 y §2.3):

| Segmento                                                          | Mínimo | Por qué                                                          |
| ----------------------------------------------------------------- | -----: | ---------------------------------------------------------------- |
| Personas de 60 años o más                                         |      2 | Usuarios con necesidades de accesibilidad y baja carga cognitiva |
| Cuidadores (compran medicamentos para otra persona)               |      1 | Hacen pedidos en nombre de otra persona, con otra modalidad      |
| Personas de 18 a 59 años que compran medicamentos con regularidad |      2 | Uso habitual del flujo                                           |
| Distinta experiencia digital (al menos 1 «baja»)                  |      — | Evitar una muestra solo de personas expertas                     |

**Exclusión:** integrantes del equipo y del curso, estudiantes de informática y personas que ya vieron la demo. La sesión piloto no cuenta en el resultado.

**Reclutamiento:** familiares, vecinos o conocidos que cumplan el perfil. No contactar a personas inscritas de la farmacia real ni pedir datos de salud: las tareas usan escenarios ficticios. Agendar con al menos una semana de anticipación (R-10) y confirmar el día anterior.

**Preguntas de selección** (se anotan en la hoja de registro con el ID del participante, sin el nombre):

1. Rango de edad: 18–39 / 40–59 / 60–74 / 75 o más.
2. ¿Compra medicamentos para usted, para otra persona o para ambos?
3. ¿Con qué frecuencia usa el teléfono o el computador para hacer trámites o compras? Nunca / A veces / Seguido.
4. ¿Usa lentes, lupa, letra grande u otra ayuda para leer la pantalla? (para ajustar el dispositivo, no para excluir).

## 4. Consentimiento informado

Leerlo en voz alta y entregar una copia. Firma en papel o confirmación verbal grabada. Los formularios firmados no se suben al repositorio.

> **Consentimiento para participar en una prueba de usabilidad**
>
> Somos estudiantes del curso Ingeniería de Software (TICS331) y estamos probando un **prototipo académico** para pedir medicamentos a la Farmacia Comunitaria de Peñalolén. **Estamos evaluando la aplicación, no a usted.** No hay respuestas correctas ni incorrectas.
>
> - Usará una **cuenta de prueba** con datos inventados. No ingrese su nombre, RUT, dirección, teléfono, contraseñas ni información sobre su salud o sus medicamentos reales.
> - El pago es **simulado**: no se usa dinero ni tarjetas, y ningún medicamento se entregará.
> - La sesión dura cerca de 40 minutos. Puede hacer pausas, saltarse una tarea o retirarse cuando quiera, sin dar explicaciones.
> - Si usted lo autoriza, grabaremos **solo el audio y la pantalla** (sin su rostro) para revisar nuestras notas. La grabación se guarda con acceso restringido al equipo y se borra al terminar el semestre.
> - Sus respuestas se identifican con un código (por ejemplo, P03). Su nombre no aparecerá en ningún informe.
>
> ☐ Acepto participar. ☐ Autorizo la grabación de audio y pantalla. ☐ Autorizo citar mis comentarios de forma anónima.
>
> Código del participante: \_\_\_\_\_ · Fecha: \_\_\_\_\_ · Firma o confirmación verbal: \_\_\_\_\_

## 5. Preparación

**Antes del día:**

- [ ] Stack de demostración arriba con el seed y probado de punta a punta por el moderador.
- [ ] Verificar que «Losartán 50 mg» y «Melatonina 3 mg» tengan stock suficiente (al menos 5 unidades) en el entorno de la prueba.
- [ ] Una cuenta de residente por sesión, con «Mi pedido» vacío. Las cuentas preinscritas son `residente1..3@demo.farmacia.cl`, con la contraseña sintética de `apps/server/.env.example`. Si hay más de 3 sesiones, rotar las cuentas y vaciar «Mi pedido» antes de cada sesión, o volver a crear la base de la prueba.
- [ ] Sesión del registrador abierta en el admin como `operador@demo.farmacia.cl` (para avanzar el pedido en la tarea 5).
- [ ] Tarjeta impresa con los datos de la cuenta de prueba y los **datos sintéticos de despacho**: sector «Villa Ficticia», referencia «Pasaje Inventado 123», alias «Vecina Demo».
- [ ] Hojas de registro (§9) y SUS impresos, o la planilla abierta; cronómetro.
- [ ] Sesión piloto realizada y guion ajustado.

**Antes de cada sesión:** navegador en la página de inicio sin sesión iniciada, historial y autocompletado limpios, tamaño de letra del dispositivo como lo usa la persona.

## 6. Tareas

Se leen en voz alta y se entregan impresas. **No usar las palabras de los botones** (por ejemplo, no decir «agregar a mi pedido» ni «simular pago»). Los tiempos objetivo son referencias para el análisis, no límites para la persona.

| #   | Tarea crítica | Escenario (se lee tal cual)                                                                                                                              | Éxito                                                                                                | Tiempo objetivo | Historias    |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------: | ------------ |
| 0   | —             | «Mire esta pantalla un momento y cuénteme qué cree que puede hacer aquí.» (calentamiento, no se mide)                                                    | —                                                                                                    |           1 min | —            |
| 1   | Búsqueda      | «Le recetaron **losartán de 50 miligramos**. Averigüe si la farmacia lo tiene y cuánto cuesta.»                                                          | Dice el precio y la disponibilidad de un producto de losartán 50 mg                                  |           2 min | HU-01        |
| 2   | Pedido        | «Quiere pedir **2 cajas** de ese medicamento y **1 caja de melatonina de 3 miligramos**. Use la cuenta de la tarjeta para dejarlas listas en su pedido.» | Ingresa con la cuenta y deja en «Mi pedido» 2 de losartán 50 mg y 1 de melatonina 3 mg               |           4 min | HU-02, HU-03 |
| 3   | Pedido        | «Esta semana no puede ir a la farmacia. Pida que se lo **lleven a domicilio** con los datos de la tarjeta y deje el pedido listo para pagar.»            | Pedido confirmado con despacho simulado y los tres datos obligatorios (queda en la pantalla de pago) |           3 min | HU-04        |
| 4   | Pedido        | «Ahora pague. Esta es una prueba: primero haga como si **el banco rechazara el pago**. Cuénteme qué pasó con su pedido. Después **páguelo con éxito**.»  | Explica que el pago fue rechazado y que no se cobró nada, y luego llega a «Pago validado»            |           3 min | HU-05        |
| 5   | Seguimiento   | _(El registrador pasa el pedido a «En preparación» en el admin.)_ «Pasaron unas horas. Revise **en qué va su pedido** y desde cuándo está así.»          | Dice que está «En preparación» y señala la hora del último cambio en la línea de tiempo              |           2 min | HU-09        |

**Indicador §3.4:** una persona cuenta como éxito si completa **sin ayuda** la búsqueda (tarea 1), el pedido (tareas 2, 3 y 4) y el seguimiento (tarea 5).

**Preguntas finales** (después del SUS):

1. ¿Qué fue lo más difícil? ¿Y lo más fácil?
2. ¿Hubo alguna palabra o mensaje que no entendió?
3. ¿Usaría algo así para pedir sus medicamentos (o los de la persona que cuida)? ¿Por qué?
4. Si pudiera cambiar una sola cosa, ¿cuál sería?

## 7. Métricas

| Métrica                         | Definición                                                                                                                                                                                                                                | Meta / uso                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Éxito sin ayuda (indicador)** | % de participantes que completa las tareas 1 a 5 con resultado **S** en todas                                                                                                                                                             | **≥ 80 %** (Inception §3.4, D-05)                            |
| Resultado por tarea             | **S** = completa sin ayuda · **A** = completa con ayuda del moderador · **F** = no completa, abandona, el resultado es incorrecto o supera 3 veces el tiempo objetivo                                                                     | Tasa S por tarea: dónde está el problema                     |
| Tiempo en tarea                 | Desde que termina la lectura del escenario hasta que la persona dice que terminó. Solo para S y A                                                                                                                                         | Mediana y rango por tarea, comparados con el tiempo objetivo |
| Errores                         | Acción que no acerca al objetivo: tocar el control equivocado, volver atrás por confusión, enviar un formulario con datos faltantes o escribir en el campo equivocado. **Error crítico:** termina con un resultado incorrecto sin notarlo | Errores por tarea; todo error crítico genera un hallazgo     |
| Facilidad percibida (SEQ)       | Después de cada tarea: «En general, ¿qué tan fácil o difícil fue esta tarea?» de 1 (muy difícil) a 7 (muy fácil)                                                                                                                          | Referencia; un SEQ ≤ 4 se revisa                             |
| SUS                             | Cuestionario de 10 afirmaciones (§7.1), puntaje de 0 a 100                                                                                                                                                                                | Referencia: el promedio de la industria es 68                |

### 7.1 Cuestionario SUS

Escala del 1 (muy en desacuerdo) al 5 (muy de acuerdo). Leer las afirmaciones en voz alta si la persona lo prefiere.

1. Creo que me gustaría usar esta aplicación con frecuencia.
2. La aplicación me pareció innecesariamente complicada.
3. La aplicación me pareció fácil de usar.
4. Creo que necesitaría ayuda de otra persona para poder usar esta aplicación.
5. Las distintas funciones de la aplicación están bien integradas.
6. La aplicación me pareció poco consistente.
7. Creo que la mayoría de las personas aprendería a usar esta aplicación muy rápido.
8. La aplicación me pareció muy engorrosa de usar.
9. Me sentí con confianza al usar la aplicación.
10. Necesité aprender muchas cosas antes de poder usar la aplicación.

**Cálculo:** en las afirmaciones impares se resta 1 a la respuesta; en las pares, a 5 se le resta la respuesta. Se suman los 10 valores y la suma se multiplica por 2,5. Ejemplo: respuestas 4,2,4,1,4,2,5,1,4,2 → (3+3+3+4+3+3+4+4+3+3) × 2,5 = 82,5.

## 8. Guion del moderador

**Introducción (leer):** «Gracias por venir. Hoy probamos una aplicación para pedir medicamentos; estamos evaluando la aplicación, no a usted. Le pediré que haga algunas tareas y que piense en voz alta: diga lo que ve, lo que busca y lo que espera que pase. Si algo no funciona o no se entiende, es un problema de la aplicación y nos sirve mucho saberlo. Yo no podré ayudarle mucho durante las tareas, porque queremos ver cómo se usa sin ayuda. Al final puede preguntarme lo que quiera.»

**Durante las tareas:**

- No guiar ni confirmar si va bien. Responder con preguntas neutras: «¿Qué espera que pase?», «¿Qué buscaría ahora?».
- Si la persona dice que no puede seguir o pasan más de 2 veces el tiempo objetivo sin avance: primero la pregunta neutra; si sigue bloqueada, dar **una pista mínima** («¿Vio la parte de abajo de la pantalla?») y marcar la tarea como **A**. Si aun así no avanza, terminar la tarea como **F**, contar la respuesta y pasar a la siguiente.
- Si una tarea falla y la siguiente depende de ella (por ejemplo, el pedido no quedó confirmado), el registrador deja el estado necesario desde otra sesión para continuar y anota el ajuste.
- Para la tarea 5, el registrador pasa el pedido a «En preparación» en el admin mientras la persona responde la SEQ de la tarea 4.
- Anotar citas textuales que muestren confusión o sorpresa.

**Cierre:** SUS, preguntas finales, agradecimiento. Aclarar que ningún pedido es real.

## 9. Hoja de registro

Una hoja por participante. Se copia a la planilla del equipo o a la tabla de §10.

```text
Participante: P__   Fecha: ____   Moderador: ____   Registrador: ____
Perfil: edad ____ · compra para: sí / otra persona / ambos · experiencia digital: baja / media / alta · ayudas de lectura: ____
Dispositivo: teléfono / computador · navegador: ____ · tamaño de letra o zoom: ____ · Grabación autorizada: sí / no

| Tarea | Resultado (S/A/F) | Tiempo (mm:ss) | Errores (n) | Error crítico (sí/no) | SEQ (1-7) | Observaciones y citas |
| ----- | ----------------- | -------------- | ----------- | --------------------- | --------- | --------------------- |
| 1     |                   |                |             |                       |           |                       |
| 2     |                   |                |             |                       |           |                       |
| 3     |                   |                |             |                       |           |                       |
| 4     |                   |                |             |                       |           |                       |
| 5     |                   |                |             |                       |           |                       |

Indicador (S en las tareas 1 a 5): sí / no
SUS (1-5): 1__ 2__ 3__ 4__ 5__ 6__ 7__ 8__ 9__ 10__ → puntaje: ____
Preguntas finales: ____
Problemas observados (pantalla, qué pasó, tarea): ____
```

## 10. Resultados

`[completar después de las sesiones]`

| Participante | Segmento | Dispositivo | T1  | T2  | T3  | T4  | T5  | Indicador   | SUS   |
| ------------ | -------- | ----------- | --- | --- | --- | --- | --- | ----------- | ----- |
| P01          |          |             |     |     |     |     |     |             |       |
| P02          |          |             |     |     |     |     |     |             |       |
| P03          |          |             |     |     |     |     |     |             |       |
| P04          |          |             |     |     |     |     |     |             |       |
| P05          |          |             |     |     |     |     |     |             |       |
| **Resumen**  |          |             | %S  | %S  | %S  | %S  | %S  | **n/N (%)** | media |

| Tarea | Tasa S | Mediana de tiempo (rango) | Errores totales | SEQ medio |
| ----- | ------ | ------------------------- | --------------- | --------- |
| 1     |        |                           |                 |           |
| 2     |        |                           |                 |           |
| 3     |        |                           |                 |           |
| 4     |        |                           |                 |           |
| 5     |        |                           |                 |           |

**Conclusión del indicador:** `[cumple / no cumple]` la meta ≥ 80 % (`n` de `N`). Si no la cumple, el riesgo R-06 pasa a **materializado** y los hallazgos que causaron las tareas F o A se priorizan en el siguiente sprint (Inception §6: todo riesgo materializado se convierte en una acción visible en el tablero).

## 11. De hallazgos a issues

1. **Consolidar** en una tabla los problemas observados: qué pasó, en qué pantalla, en qué tarea y cuántos participantes lo tuvieron.
2. **Clasificar la severidad:**

   | Severidad | Criterio                                                          | Prioridad sugerida al PO                      |
   | --------- | ----------------------------------------------------------------- | --------------------------------------------- |
   | Crítica   | Impide completar una tarea crítica (F) o produce un error crítico | Must; corregir antes de aceptar el incremento |
   | Seria     | La persona necesitó ayuda (A) o perdió mucho tiempo               | Should para el siguiente sprint               |
   | Menor     | Duda o error del que la persona se recuperó sola                  | Could                                         |
   | Cosmética | Comentario de preferencia sin efecto en la tarea                  | Registrar; el PO decide                       |

3. **Crear un issue por problema** (no uno por participante). Los problemas de accesibilidad llevan además la etiqueta `accessibility`:

   ```bash
   gh issue create -R raztor/farmacias \
     --title "Usabilidad: <problema en una frase>" \
     --label "bug,app:mobile,modulo:calidad" \
     --body-file hallazgo.md
   ```

   Contenido de `hallazgo.md`:

   ```markdown
   ## Hallazgo de usabilidad (T-11, #34)

   - **Qué pasó:** …
   - **Dónde:** pantalla / componente …
   - **Tarea y participantes:** tarea N · P02, P05 (2 de 8)
   - **Severidad:** crítica / seria / menor / cosmética
   - **Evidencia:** cita anónima, tiempo, errores (sin datos personales)
   - **Historia o requisito afectado:** HU-xx · RNF-01/02/09
   - **Propuesta:** …
   - **Criterio para cerrar:** cómo se verificará (prueba automatizada o nueva sesión)
   ```

4. **Agregar los issues al tablero** (Project 8) en _Backlog_ y comentar en #34 la lista de issues creados. El PO los prioriza en la siguiente planificación; los hallazgos críticos se discuten en la misma review (R-12: no se agregan al sprint en curso sin evaluar su impacto).
5. **Actualizar** la tabla de resultados de este documento, el indicador en [`docs/traceability.md` §4](../traceability.md#4-indicadores-de-éxito-34-d-05) y el informe del [Sprint 2](../sprints/sprint-2.md).

## 12. Privacidad

- Solo cuentas y datos sintéticos (RNF-06). Si una persona escribe un dato real por error, se borra del entorno de prueba al terminar la sesión.
- En los documentos y en los issues se usa solo el código del participante (P01…). Nombres, formularios de consentimiento y grabaciones quedan fuera del repositorio, con acceso restringido al equipo, y se eliminan al terminar el semestre.
- Las capturas que se agreguen como evidencia no deben mostrar rostros, nombres ni notificaciones personales del dispositivo.
