import type { Metadata } from 'next';
import './globals.css';
import './themes.css';
export const metadata: Metadata = { title: 'La Cava · Administración', description: 'Demo de ventas e inventario para una licorería boliviana' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="es" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('lacava-theme');if(!['light','dark','neon'].includes(t)){var old=JSON.parse(localStorage.getItem('lacava-v1')||'null');t=old&&['dark','neon'].includes(old.theme)?old.theme:'light';}document.documentElement.dataset.theme=t;}catch{document.documentElement.dataset.theme='light';}`}}/></head><body>{children}</body></html> }
