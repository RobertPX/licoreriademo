import type {Data,Theme} from './store';
import type {Command} from './commands';
export type Result={data:Data;resultId?:string};
const THEME_KEY='lacava-theme';
export function loadTheme():Theme{
 try{const value=localStorage.getItem(THEME_KEY);if(value==='light'||value==='dark'||value==='neon')return value;
 // Solo recuperamos la preferencia visual antigua; no subimos datos locales a la base compartida.
 const legacy=JSON.parse(localStorage.getItem('lacava-v1')||'null')?.theme;
 return legacy==='dark'||legacy==='neon'?legacy:'light';}catch{return 'light';}
}
export function saveTheme(theme:Theme){localStorage.setItem(THEME_KEY,theme);}
async function request(init?:RequestInit):Promise<Result>{
 let response:Response;
 try{response=await fetch('/api/data',{...init,cache:'no-store',signal:AbortSignal.timeout(25000)});}catch{throw new Error('No se pudo confirmar la conexión. Reintenta la misma operación; no se duplicará.');}
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(body?.error||'No se pudo completar la operación.');
 if(!body?.data||!Array.isArray(body.data.products)||!Array.isArray(body.data.sales)||!Array.isArray(body.data.purchases)||!body.data.business)throw new Error('No se pudo confirmar la respuesta del servidor. Reintenta la misma operación.');
 return body as Result;
}
const pending=new Map<string,string>();
type Mutation=Command extends infer C ? C extends Command ? Omit<C,'id'> : never : never;
export const repository={
 load:()=>request(),
 async execute(mutation:Mutation):Promise<Result>{
   const signature=JSON.stringify(mutation);
   const key='lacava-pending:'+signature;
   let id=pending.get(signature);
   try{id=id||sessionStorage.getItem(key)||undefined;}catch{/* Sigue funcionando sin almacenamiento de sesión. */}
   id=id||crypto.randomUUID();pending.set(signature,id);
   try{sessionStorage.setItem(key,id);}catch{/* El reintento en esta página conserva su identificador. */}
   const result=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...mutation,id})});
   pending.delete(signature);try{sessionStorage.removeItem(key);}catch{/* Preferencia local opcional. */}
   return result;
 },
};
