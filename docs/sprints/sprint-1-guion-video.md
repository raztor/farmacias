# Guion del video · Sprint 1 Review

> Duración objetivo **4:30** (máximo del curso: 5:00). Tarea T-07 ([#30](https://github.com/raztor/farmacias/issues/30)). Informe: [sprint-1.md](./sprint-1.md).

Contenido que exige la guía del curso: objetivo del sprint, historias completadas y pendientes, demo del incremento y aprendizajes.

## Preparación (antes de grabar)

1. **Levantar el stack con datos sintéticos.** La opción más simple es el stack E2E, que deja todo listo con migraciones y seed:

   ```bash
   pnpm --filter @repo/e2e e2e:stack   # API :4000, admin :3001, web de la app :8081 (Ctrl+C para detener)
   ```

   Otra opción es el stack de demostración en contenedores (`docs/DEPLOYMENT.md`, «Stack completo con Docker Compose») seguido de `pnpm db:seed`.

2. **Cuentas:** `residente1@demo.farmacia.cl` para la demo; las contraseñas sintéticas están en `apps/server/.env.example` (`SEED_RESIDENT_PASSWORD`). No mostrar el archivo `.env` en pantalla.
3. **Navegador:** ventana limpia (sin marcadores ni extensiones visibles), zoom 125 % para que el texto se lea en el video, notificaciones del sistema desactivadas.
4. **Producto con stock bajo para la demo de inventario:** buscar «carvedilol» y anotar el número de «Quedan pocas (N)» de «Carvedilol Quillay» (en las capturas de evidencia, N = 4).
5. **Terminal** con la fuente grande y el comando de §3 ya escrito.
6. **Ensayar una vez con cronómetro.** Si un bloque se pasa del tiempo, acortar la narración, no la demo.

## Guion

| Tiempo    | Quién         | Qué se muestra                                                                                                                                                                                           | Narración sugerida                                                                                                                                                                                                                     |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | `[completar]` | Portada: nombre del proyecto, equipo, PO, «Sprint 1».                                                                                                                                                    | «Somos Better Name Pending. Este es el Sprint 1 del sistema de pedidos de la Farmacia Comunitaria de Peñalolén. Su objetivo: que una persona inscrita busque, pida y pague de forma simulada, con el stock descontado una sola vez.»   |
| 0:20–0:50 | `[completar]` | Tablero [Project 8](https://github.com/users/raztor/projects/8) filtrado por _Sprint 1_: HU-01..HU-06 y T-01..T-07 con sus puntos (48).                                                                  | «Comprometimos 13 ítems y 48 puntos, todos Must. Las seis historias están implementadas con pruebas; quedan pendientes la revisión del PR y la aceptación del PO.» `[ajustar con el estado real del día]`                              |
| 0:50–1:30 | `[completar]` | **HU-01.** Catálogo sin sesión → escribir «losartan» (sin tilde) → aparece «Losartán» con precio y «Disponible» → buscar «xyz» → «No encontramos resultados» → «Modificar la búsqueda».                  | «Sin iniciar sesión se ve el precio y la disponibilidad. La búsqueda funciona por nombre o principio activo, con o sin tildes. Si no hay resultados lo decimos y se puede cambiar el término.»                                         |
| 1:30–1:50 | `[completar]` | **HU-02.** «Mi cuenta» → contraseña incorrecta → mensaje genérico → ingresar con `residente1`.                                                                                                           | «No hay registro público: las cuentas sintéticas vienen preinscritas. Si un dato es incorrecto, el mensaje no dice cuál.»                                                                                                              |
| 1:50–2:30 | `[completar]` | **HU-03.** Abrir «Carvedilol Quillay» («Quedan pocas (N)») → intentar pasar el máximo («+» se deshabilita, «Puedes agregar hasta N») → agregar 2 → barra «Mi pedido (2)» → pantalla Mi pedido con total. | «La cantidad está acotada a la disponibilidad real. Si alguien intenta pasarse, el servidor también lo rechaza e indica el máximo.»                                                                                                    |
| 2:30–3:00 | `[completar]` | **HU-04.** Confirmar → «Despacho simulado» sin sector → «Indica el sector» en el campo → cambiar a «Retiro en farmacia» (sin dirección) → confirmar.                                                     | «En despacho pedimos solo datos sintéticos y marcamos el campo que falta. En retiro no se pide dirección.»                                                                                                                             |
| 3:00–3:40 | `[completar]` | **HU-05 y HU-06.** «Simular pago rechazado» → mensaje de rechazo → volver al producto: sigue «Quedan pocas (N)» → «Simular pago aprobado» → «Pago validado» → el producto muestra N − 2.                 | «El rechazo no toca el inventario. Con el pago aprobado, el pedido pasa a Pago validado y el stock baja en la misma transacción. Si la misma solicitud se repite, no se descuenta dos veces.»                                          |
| 3:40–4:00 | `[completar]` | **Evidencia.** Terminal: `pnpm --filter @repo/api test:integration payments.concurrency` (con `TEST_DATABASE_URL`; ejecutarlo antes y mostrar el resultado en verde) y luego los checks del PR #37.      | «Lo probamos sobre PostgreSQL real: 20 pagos en paralelo compiten por las últimas 5 unidades y solo 5 se validan; el stock nunca queda negativo.»                                                                                      |
| 4:00–4:20 | `[completar]` | Diapositiva de aprendizajes y riesgos (§6 y §7 del informe).                                                                                                                                             | «Aprendimos que escribir las specs antes del código nos permitió trabajar en paralelo, y que la consistencia de pago y stock hay que demostrarla en una base de datos real. Sigue abierta la validación con la operación real (R-03).» |
| 4:20–4:30 | `[completar]` | Diapositiva de próximos pasos.                                                                                                                                                                           | «En el Sprint 2: la bandeja del operario, el avance físico del pedido, el seguimiento y la validación con usuarios.»                                                                                                                   |

## Después de grabar

- [ ] Duración ≤ 5:00 (revisar en el reproductor).
- [ ] En pantalla no aparecen contraseñas, `.env`, correos personales ni datos reales.
- [ ] Subir el video (visibilidad: «no listado» o la que pida el curso) y pegar el enlace en [sprint-1.md](./sprint-1.md) y en [#30](https://github.com/raztor/farmacias/issues/30).
- [ ] Comprobar que el enlace abre desde una sesión sin iniciar (R-09).
