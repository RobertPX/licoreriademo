import 'server-only';
import {getCloudflareContext} from '@opennextjs/cloudflare';

type Bindings={SUPABASE_URL?:string;SUPABASE_SECRET_KEY?:string;DEMO_PUBLIC_ACCESS?:string};
export class ApiError extends Error{
 status:number;
 constructor(message:string,status=500){super(message);this.status=status;}
}
export async function configuration():Promise<Required<Bindings>>{
 let env:Bindings={};
 try{env=(await getCloudflareContext({async:true})).env as Bindings;}catch{/* next dev utiliza .env.local */}
 const url=env.SUPABASE_URL||process.env.SUPABASE_URL;
 const key=env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SECRET_KEY;
 const demo=env.DEMO_PUBLIC_ACCESS||process.env.DEMO_PUBLIC_ACCESS;
 if(!url||!key)throw new ApiError('Falta configurar la conexión de Supabase en el servidor.',503);
 if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url))throw new ApiError('La URL de Supabase del servidor no es válida.',503);
 if(demo!=='true')throw new ApiError('El acceso a esta demo no está habilitado.',503);
 return {SUPABASE_URL:url.replace(/\/$/,''),SUPABASE_SECRET_KEY:key,DEMO_PUBLIC_ACCESS:demo};
}
export async function rpc(name:'lacava_snapshot'|'lacava_command',args:Record<string,unknown>,config:Required<Bindings>){
 const headers:Record<string,string>={'Content-Type':'application/json',apikey:config.SUPABASE_SECRET_KEY};
 // Las claves secretas nuevas no son JWT. Las service_role antiguas sí requieren Bearer.
 if(!config.SUPABASE_SECRET_KEY.startsWith('sb_secret_'))headers.Authorization=`Bearer ${config.SUPABASE_SECRET_KEY}`;
 let response:Response;
 try{response=await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new ApiError('No se pudo confirmar la operación con Supabase. Reintenta la misma solicitud.',503);}
 const body=await response.json().catch(()=>null);
 if(!response.ok){
   if(body?.code==='P0001')throw new ApiError(body.message,409);
   if(['23502','23514','22003','22P02','22008','22007'].includes(body?.code))throw new ApiError('Los datos no son válidos o exceden los límites permitidos.',400);
   // No registrar encabezados, claves ni respuestas completas del proveedor.
   console.error('Supabase RPC failed',{operation:name,status:response.status,code:body?.code});
   throw new ApiError('No se pudo acceder a la base de datos. Comprueba la configuración y las migraciones.',503);
 }
 return body;
}
