# Decisiones de arquitectura (ADR)

Un ADR (_Architecture Decision Record_) documenta **una** decisión importante: el contexto en que se tomó, qué se decidió y qué consecuencias tiene. Sirven para que quien llegue después entienda por qué el repo es como es, sin depender de la memoria del equipo.

## Cuándo escribir un ADR

- Elegir o reemplazar una tecnología, librería o servicio relevante.
- Cambiar una regla del repositorio (límites de código, reglas de arquitectura, política de dependencias). Es obligatorio según [docs/REPO_RULES.md §11](../REPO_RULES.md#11-cómo-cambiar-una-regla).
- Fijar una versión por debajo de la última disponible, o decisiones que serían difíciles de revertir.

## Cómo escribirlo

1. Copia la plantilla de abajo en `docs/adr/NNNN-titulo-en-kebab-case.md`, con el siguiente número correlativo de 4 dígitos.
2. Escríbelo en español, breve (idealmente menos de una página), y con estado `Propuesto`.
3. Ábrelo en un PR junto con el cambio que implementa la decisión (configuración, código y documentación).
4. Al aprobarse el PR, cambia el estado a `Aceptado`.
5. Los ADR no se reescriben: si una decisión cambia, se crea un ADR nuevo y el anterior pasa a `Reemplazado por NNNN`.

## Plantilla

```markdown
# NNNN. Título de la decisión

- **Estado:** Propuesto | Aceptado | Rechazado | Obsoleto | Reemplazado por NNNN
- **Fecha:** AAAA-MM-DD
- **Autores:** @usuario

## Contexto

Qué problema hay, qué restricciones existen (técnicas, de equipo, de plazos) y qué fuerzas están en juego.

## Opciones consideradas

1. Opción A — ventajas / desventajas.
2. Opción B — ventajas / desventajas.

## Decisión

Qué se decidió, en una o dos frases claras.

## Consecuencias

- Positivas: …
- Negativas / costos: …
- Qué hay que revisar en el futuro (y cuándo).
```

## Índice

| N.º                               | Título            | Estado   |
| --------------------------------- | ----------------- | -------- |
| [0001](0001-stack-y-versiones.md) | Stack y versiones | Aceptado |
