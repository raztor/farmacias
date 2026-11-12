# Entregas de sprint

Material de cada Sprint Review según la guía del curso (informe, tablero actualizado, repositorio, diagramas y video de 5 minutos como máximo). Cada sprint tiene un informe; los Sprints 1 y 2 tienen además un guion de video (el video del Sprint 3 no forma parte de la tarea T-15). La evidencia gráfica está en [`evidencia/`](./evidencia).

| Sprint   | Informe                      | Guion del video                                      | Issue                                                |
| -------- | ---------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Sprint 1 | [sprint-1.md](./sprint-1.md) | [sprint-1-guion-video.md](./sprint-1-guion-video.md) | [#30](https://github.com/raztor/farmacias/issues/30) |
| Sprint 2 | [sprint-2.md](./sprint-2.md) | [sprint-2-guion-video.md](./sprint-2-guion-video.md) | [#36](https://github.com/raztor/farmacias/issues/36) |
| Sprint 3 | [sprint-3.md](./sprint-3.md) | —                                                    | [#44](https://github.com/raztor/farmacias/issues/44) |

La prueba de usabilidad (T-11, [#34](https://github.com/raztor/farmacias/issues/34)) está en [`docs/validation/usabilidad.md`](../validation/usabilidad.md).

## Cómo cerrar la entrega de un sprint

Los informes son **borradores con datos del repositorio y del tablero** al 3 de noviembre de 2026. Antes de entregar, el equipo:

1. Completa los campos marcados con `[completar]` (fechas, asistentes, enlace del video, comentarios del Product Owner).
2. Revisa el tablero ([Project 8](https://github.com/users/raztor/projects/8)) y actualiza la columna «Estado en el tablero» de cada historia. Solo cuenta como **terminada** la historia que cumple la Definition of Done completa (PR aprobado con CI en verde, desplegada en demo y aceptada por el PO).
3. Revisa los riesgos R-01..R-12 en la reunión y anota los cambios (el Inception §6 exige revisarlos al menos una vez por sprint; todo riesgo materializado se convierte en un issue del tablero).
4. Graba el video con el guion (máximo 5 minutos), lo sube y pega el enlace en el informe y en el issue del sprint.
5. Comprueba desde una sesión sin permisos de escritura que el equipo docente puede ver el repositorio, el tablero y el video (riesgo R-09).

## Fuentes de los datos

- Historias, puntos, sprint y estado: GitHub Project 8 (campos _Estimate_, _Sprint_, _MoSCoW_ y _Status_).
- Avance y evidencia: comentarios de cada issue y PR borrador [#37](https://github.com/raztor/farmacias/pull/37) (rama `feat/sprint-1-mvp`).
- Criterio de aceptación → prueba: [`docs/traceability.md`](../traceability.md).
- Diagramas UML: [`docs/uml/`](../uml) (PlantUML) y Mermaid en [`docs/specs/`](../specs).
