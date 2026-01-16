# PROJECT_MAP.md

## Árbol permitido de carpetas en `src/`
Solo se permiten estas carpetas de primer nivel dentro de `src/`:

- `presentation/`
- `domain/`
- `data-access/`
- `data/`
- `shared/`

## Regla de dependencias (quién importa a quién)
Flujo permitido de dependencias:

`data-access` → `domain`
`data-access` → `shared`
`domain` → `shared`
`data` → `shared`

Reglas específicas:
- `presentation` (renderer) solo puede importar `shared` y su propio código.
- `presentation` NO depende de `data-access`.
- `presentation` NO importa `domain` por defecto.
  - Excepción temporal: si hoy ya existen imports a `domain`, se toleran mientras se migra a use cases, pero **NO** se permiten nuevos.
- `domain` NO depende de `data-access`.
- `data-access` puede depender de `domain` y `shared`.
- `data` puede importar `shared`.
- `shared` no debe importar nada de las otras capas.

## Flujo renderer <-> main (IPC)
- `presentation` (renderer) → IPC → `main` (application/use cases) → `domain` → `data-access` → `storage`

## Dónde vive `main` (application/use cases)
- Usar la carpeta existente `src/main/` (o la equivalente ya presente en el repo).
- `main` contiene: handlers IPC, casos de uso, wiring de repos, `DatabaseService`.

## Política anti-caos
Antes de cualquier cambio:
1) **Listar** los archivos que se tocarán.
2) Si se crea un archivo nuevo, **justificar**:
   - Ruta exacta.
   - Por qué es necesario.
   - Cómo se integra con el resto del sistema.

## Regla: no crear archivos nuevos si se puede editar uno existente
- Si un requerimiento se resuelve editando un archivo actual, **no** se crea un archivo nuevo.

## Regla: cambios pequeños por iteración
- Máximo **7 archivos** modificados por iteración.

## Regla: no romper contratos IPC
- Si cambias tipos o payloads, debes mantener compatibilidad o **versionar el canal**.

## Regla: interfaces/ports
- Si hay interfaces o ports, van en `domain` (o `shared`), **no** en `data-access`.

## Regla: cambios con migración
- Si una mejora requiere reacomodar imports, primero crear adaptadores o re-exports para no romper UI, y migrar en pasos.
