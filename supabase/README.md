# Supabase · La Cava

Esta carpeta prepara la base de datos de la aplicación. El proyecto alojado (URL y claves) se crea primero desde el Dashboard de Supabase; SQL no crea la cuenta ni el proyecto alojado.

## 1. Crear la base

En un proyecto Supabase **nuevo**, abre SQL Editor y ejecuta, en este orden, cada archivo completo:

1. `migrations/001_schema.sql`: tablas, restricciones, índices, RLS y permisos.
2. `migrations/002_operations.sql`: lectura consistente y comandos transaccionales.
3. `seed.sql`: opcional, solo para demostración; ocho productos, una compra y 24 ventas ficticias.

Cada migración tiene su propia transacción. Las migraciones se aplican una sola vez; si vuelves a ejecutar una migración ya aplicada, fallará sin borrar información. La seed sí se puede repetir: no duplica sus operaciones ni sustituye productos ya existentes. Sus fechas corresponden al momento de la primera ejecución.

Deja habilitada Data API con `public` en los esquemas expuestos (configuración predeterminada). No crees políticas `USING (true)`. No necesitas Storage, Realtime, Auth, extensiones externas ni una conexión PostgreSQL desde el Worker.

## 2. Variables de desarrollo

Copia `.env.example` a `.env.local` y completa:

```dotenv
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
DEMO_PUBLIC_ACCESS=true
```

Obtén la URL en **Connect** o en la configuración de API y una clave **secret** del servidor en **Settings → API Keys**. También se admite la clave JWT `service_role` antigua. Una clave publishable/anon no sirve para esta arquitectura.

Nunca uses el prefijo `NEXT_PUBLIC_` para la clave, nunca la pegues en código ni la subas a Git. No se necesita una clave pública en el navegador.

```sh
npm ci
npm run dev
```

La aplicación accede a `/api/data`; solo el servidor contacta Supabase por HTTPS. Sin configuración, muestra un error y permite reintentar. No cambia silenciosamente a datos ficticios.

## 3. Cloudflare Workers

Se conservan el Worker `licoreriademo`, `WORKER_SELF_REFERENCE`, los assets, la fecha de compatibilidad y los comandos de OpenNext existentes.

En **Workers & Pages → licoreriademo → Settings → Variables and Secrets**, agrega las siguientes variables de ejecución en el entorno que despliegas:

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | URL del proyecto |
| `SUPABASE_SECRET_KEY` | Secret | Clave secret/service_role |
| `DEMO_PUBLIC_ACCESS` | Variable | `true` para habilitar la demo sin login |

Para preview local, copia `.dev.vars.example` a `.dev.vars` y completa las mismas variables. Estos archivos están ignorados por Git. Los ejemplos contienen solo marcadores.

```sh
npm run typecheck
npm test
npm run build
npm run cf:build
npm run preview
```

En Workers Builds conserva `npm run cf:build` como build y `npx wrangler deploy` como deploy. No se necesitan claves durante el build: se leen en tiempo de ejecución mediante el contexto de OpenNext y, en `next dev`, mediante `.env.local`. Las variables exclusivas del entorno de compilación no sustituyen los secrets del Worker.

No agregues las claves a `wrangler.jsonc`. Las credenciales locales de Wrangler tampoco deben publicarse.

## 4. Comprobar la demo

1. Abre la aplicación y comprueba que aparecen los ocho productos.
2. Registra una venta: verifica el comprobante, el historial y el descuento de existencias.
3. En otro navegador, abre Inventario o pulsa **Actualizar datos** y verifica el cambio.
4. Registra una compra con dos productos: comprueba existencias, costo promedio y detalle.
5. Edita un producto y los datos comerciales. Recarga y verifica que se conservan.
6. Revisa reportes y descarga el CSV. Cambiar de sección vuelve a consultar Supabase.
7. El tema se conserva solo en ese navegador.

Los datos de negocio anteriores en `lacava-v1` no se importan automáticamente a la base compartida; esa clave no se elimina. Se recupera únicamente su tema visual. Esto evita mezclar o duplicar las ventas ficticias guardadas por cada navegador.

## Integridad y límites

- Los totales, precios y costos de ventas se calculan en PostgreSQL, nunca se confía en el total enviado por el cliente.
- Venta, líneas, stock y movimientos se guardan en una sola transacción. Lo mismo ocurre con las compras.
- Las compras usan promedio ponderado, mantienen precios de venta y respetan costos históricos.
- Las escrituras de esta única tienda se serializan con un bloqueo transaccional. Versiones optimistas impiden que un formulario viejo sobrescriba inventario o configuración más reciente.
- Cada comando utiliza un UUID y una constancia persistente para evitar duplicados al reintentar. El navegador conserva identificadores pendientes en la sesión; si el almacenamiento está bloqueado, los conserva mientras la página siga abierta. Ante una desconexión, reintenta la misma operación antes de cambiar el pedido.
- RLS está activado en todas las tablas; anon y authenticated no tienen acceso directo. Las funciones usan `security invoker`, un `search_path` vacío y ejecución restringida a service_role. La clave privilegiada solo vive en el servidor.
- `DEMO_PUBLIC_ACCESS=true` habilita lectura y escritura compartida **sin identidad ni roles**. Quien acceda a la web puede operar la tienda. No uses datos sensibles en esta fase. Puedes proteger la presentación con Cloudflare Access antes de incorporar login propio.
- Antes de un uso comercial real: añadir Auth, autorización por rol/negocio en la API y políticas correspondientes, límites de tráfico en Cloudflare, backups y recuperación comprobada. El historial se carga completo; para un volumen grande debe paginarse y calcular reportes en servidor.
- No hay procesamiento bancario, facturación fiscal, devoluciones ni cancelaciones. Los reportes PDF y CSV se generan en el navegador con los datos cargados; el PDF incluye encabezado comercial, resumen, ventas, compras e inventario actual.

## Pruebas de base de datos

`tests/database.sql` comprueba integridad, rollback, costos, idempotencia, control de versiones y permisos. Ejecútalo solo en una base de pruebas con las migraciones aplicadas; revierte sus operaciones al terminar. No hace falta ejecutarlo para instalar la demo.

Usa Node.js 22.18 o superior (recomendado 24) para las pruebas. Con PostgreSQL instalado y un usuario local que no sea root:

```sh
npm run test:db
```

El runner crea un cluster temporal, aplica las migraciones, repite la seed y ejecuta las comprobaciones como service_role. No abre puertos ni contacta la base real. Si `pg_config` no está disponible, indica la carpeta de binarios con `PG_BIN`.

## Referencias

- [Funciones y permisos en Supabase](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Bindings de OpenNext para Cloudflare](https://opennext.js.org/cloudflare/bindings)
