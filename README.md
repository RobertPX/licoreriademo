# La Cava · Demo de administración

Administración de una licorería boliviana con Next.js App Router, React, TypeScript y Supabase. Interfaz en español, moneda BOB y fechas de Bolivia. Despliegue en Cloudflare Workers mediante OpenNext.

## Preparación

Sigue [supabase/README.md](supabase/README.md) para crear las tablas, aplicar funciones y cargar datos ficticios. Copia `.env.example` a `.env.local`, configura la URL y la clave secreta del servidor y habilita explícitamente la demo con `DEMO_PUBLIC_ACCESS=true`.

```sh
npm ci
npm run dev
```

Abre http://localhost:3000. Los datos de productos, ventas, compras y negocio son compartidos en Supabase. El tema claro, oscuro o neón se guarda por navegador. Los datos antiguos de `lacava-v1` no se importan automáticamente.

Incluye resumen, punto de venta (QR, efectivo y tarjeta registrados manualmente), inventario editable, alta de productos, historial, comprobantes internos y reportes CSV. Las ventas descuentan stock y guardan sus costos históricos. Las compras recibidas aumentan stock y actualizan el costo promedio ponderado.

La API del Worker conserva las credenciales en el servidor. Las operaciones de venta y compra son transaccionales y los reintentos usan identificadores persistentes para evitar duplicados. Las ediciones de productos y negocio detectan versiones desactualizadas.

**Demo sin login:** cualquiera con acceso a la aplicación puede leer y modificar los datos compartidos. Antes de usar datos reales hacen falta autenticación y autorización. No hay facturación fiscal ni cobro bancario. Los reportes PDF incluyen resumen, ventas detalladas, compras e inventario actual, con encabezado del negocio, moneda BOB y fechas de Bolivia. En Reportes respetan el período seleccionado; en Configuraciones abarcan los últimos 30 días.

## Verificación

```sh
npm test
npm run test:db # requiere PostgreSQL local; usa una base temporal
npm run typecheck
npm run build
npm run cf:build
```

## Cloudflare Workers

Se conserva el Worker `licoreriademo` y su configuración. Agrega `SUPABASE_URL`, el secret `SUPABASE_SECRET_KEY` y `DEMO_PUBLIC_ACCESS=true` en las variables de ejecución del Worker. Para preview local, completa `.dev.vars` desde `.dev.vars.example`.

```sh
npm run preview
npm run deploy
```

En Workers Builds, el build sigue siendo `npm run cf:build` y el deploy `npx wrangler deploy`. No necesita R2 para almacenar datos. Consulta las instrucciones completas y las comprobaciones entre dispositivos en [supabase/README.md](supabase/README.md).
