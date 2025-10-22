# Arquitectura en capas

Este proyecto se reorganiza en 4 capas principales, más utilidades compartidas. La meta es separar responsabilidades y facilitar mantenimiento y pruebas.

Capas:

1) Presentación (UI):
   - Ruta: `src/presentation`
   - Responsabilidad: pantallas, componentes, controladores de vista, validaciones mínimas de formulario. No conoce detalles de persistencia.

2) Lógica de negocio (Dominio):
   - Ruta: `src/domain`
   - Responsabilidad: reglas de negocio, casos de uso/servicios, validación de entidades, orquesta repositorios.

3) Acceso a datos:
   - Ruta: `src/data-access`
   - Responsabilidad: repositorios e implementaciones (por ejemplo: JSON vía IPC de Electron). No contiene reglas de negocio.

4) Datos (Modelos/Esquemas):
   - Ruta: `src/data`
   - Responsabilidad: modelos, esquemas, definición de tablas/archivos y mapeos. Independiente de UI.

Compartidos:
   - Ruta: `src/shared`
   - Tipos y constantes transversales (ya existente).

Módulos funcionales (ejemplos):
   - Ventas, Productos, Clientes, Reportes, Corte de Caja, Configuración.

Convenciones:
   - Cada módulo puede tener subcarpetas homónimas en cada capa: `presentation/modules/<modulo>`, `domain/<modulo>`, `data-access/<modulo>`, `data/models/<modulo>`.
   - La UI consume servicios del dominio, y éstos dependen de interfaces de repositorio (invertimos dependencias).
   - Implementaciones de repositorio viven en `data-access` y dependen de `data` para los modelos/esquemas.

Compatibilidad multiplataforma:
   - Evitar dependencias específicas de OS en la UI y dominio.
   - El acceso a datos debe resolverse con rutas provistas por Electron (userData) u otras abstracciones, nunca con paths hardcodeados.
