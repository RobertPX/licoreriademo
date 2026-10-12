# La Cava · Demo de administración

Next.js (App Router), React y TypeScript. Interfaz en español, moneda BOB y fechas de Bolivia.

## Desarrollo

```sh
npm install
npm run dev
```

Abre http://localhost:3000. Incluye resumen, punto de venta (QR, efectivo y tarjeta), inventario editable, alta de productos, historial, comprobantes internos y reportes CSV. Las ventas descuentan stock y registran el costo de cada producto para calcular el margen histórico.

## Datos de la demo

### Compras y configuraciones

Compras registra mercadería recibida con proveedor, fecha, factura/referencia, observaciones y varios productos. Cada recepción aumenta stock y actualiza el costo promedio ponderado; conserva el precio de venta y los costos históricos de ventas. No incluye cuentas por pagar ni órdenes pendientes.

Configuraciones guarda nombre comercial, razón social, NIT, dirección principal, dirección de sucursal, ciudad, teléfono y correo. Incluye vista previa del encabezado y temas claro, oscuro y neón persistentes. El botón Reporte PDF se muestra en Reportes y Configuraciones; informa que la función está pendiente y no genera archivos todavía.

Los datos guardados en la versión anterior se migran al cargarse sin perder productos ni ventas. Pruebas de compras y migración: `node --experimental-strip-types --test tests/purchases.test.mjs`.

Se guardan en `localStorage`, clave `lacava-v1`. No se comparten entre navegadores ni dispositivos. Para reiniciar elimina esa clave desde las herramientas del navegador. Los registros iniciales son ficticios; las existencias representan el inventario disponible al iniciar la demo. No hay autenticación ni facturación fiscal. El pago se registra manualmente; no procesa cobros.

`src/lib/store.ts` contiene los modelos y el repositorio local. Al integrar Supabase, sustituye este repositorio por operaciones asíncronas y realiza la venta y el descuento de stock en una transacción del servidor. Añade Supabase Auth, roles y RLS antes de manejar datos reales. Nunca expongas una service role key en el cliente.

## Cloudflare Workers

Configurado con `@opennextjs/cloudflare`, Wrangler y `nodejs_compat`, siguiendo https://opennext.js.org/cloudflare/get-started. No usa runtime Edge ni una base de datos.

```sh
npm run build
npm run cf:build
npm run preview
```

`preview` ejecuta la aplicación en el runtime de Workers. Para desplegar, autentícate con `npx wrangler login` y ejecuta `npm run deploy`. El nombre del Worker es `licoreria-demo` en `wrangler.jsonc`; si lo cambias, actualiza también `WORKER_SELF_REFERENCE`. No necesita R2 para los datos de esta demo.

```sh
npm run typecheck
```

Las fuentes web tienen alternativas del sistema si no hay conexión.
