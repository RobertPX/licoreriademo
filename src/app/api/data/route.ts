import {ApiError,configuration,rpc} from '@/lib/server/supabase';
import {validateCommand} from '@/lib/commands';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
function failure(error:unknown){
 if(error instanceof ApiError)return Response.json({error:error.message},{status:error.status,headers});
 return Response.json({error:'No se pudo completar la operación.'},{status:500,headers});
}
export async function GET(){
 try{const config=await configuration();return Response.json({data:await rpc('lacava_snapshot',{},config)},{headers});}catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
   // Rechaza escrituras iniciadas por otra web. No sustituye a autenticación.
   const origin=request.headers.get('origin');
   if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError('Origen no permitido.',403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('Se requiere JSON.',415);
   if(Number(request.headers.get('content-length'))>65536)throw new ApiError('Solicitud demasiado grande.',413);
   const reader=request.body?.getReader();
   if(!reader)throw new ApiError('Solicitud vacía.',400);
   const chunks:Uint8Array[]=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new ApiError('Solicitud demasiado grande.',413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   let command;
   try{command=validateCommand(JSON.parse(new TextDecoder().decode(bytes)));}catch(error){throw new ApiError(error instanceof Error?error.message:'Solicitud inválida.',400);}
   const config=await configuration();
   const result=await rpc('lacava_command',{p_id:command.id,p_action:command.action,p_payload:command.payload},config);
   return Response.json(result,{headers});
 }catch(error){return failure(error);}
}
