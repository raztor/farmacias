# Diagramas UML

Fuentes PlantUML de los diagramas del MVP. Las mismas vistas están en Mermaid dentro de las specs (GitHub las muestra sin herramientas extra); si cambian, se actualizan ambas en el mismo PR.

| Diagrama                      | Fuente                                             | Vista Mermaid                                                                         |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Modelo entidad-relación       | [`er.puml`](./er.puml)                             | [specs/README — Modelo de datos](../specs/README.md#modelo-de-datos-entidad-relación) |
| Máquina de estados del pedido | [`order-states.puml`](./order-states.puml)         | [specs/order-status](../specs/order-status.md#4-estados-y-transiciones)               |
| Secuencia del pago simulado   | [`payment-sequence.puml`](./payment-sequence.puml) | [specs/payments](../specs/payments.md#4-estados-y-transiciones)                       |
| Componentes                   | [`components.puml`](./components.puml)             | [specs/README — Componentes](../specs/README.md#componentes)                          |
| Despliegue                    | [`deployment.puml`](./deployment.puml)             | [ARCHITECTURE — Vista general](../ARCHITECTURE.md#vista-general)                      |

## Generar imágenes

Con PlantUML instalado (requiere Java) o con su imagen de contenedor:

```bash
# local
plantuml -tsvg docs/uml/*.puml

# con Podman o Docker, sin instalar nada
podman run --rm -v "$PWD/docs/uml:/data" docker.io/plantuml/plantuml -tsvg /data/*.puml
```

Las imágenes generadas no se versionan: la fuente es el `.puml`.
