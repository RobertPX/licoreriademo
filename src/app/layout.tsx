import type { Metadata } from 'next';
import './globals.css';
import './themes.css';
export const metadata: Metadata = { title: 'La Cava · Administración', description: 'Demo de ventas e inventario para una licorería boliviana' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html> }
