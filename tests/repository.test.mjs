import test from 'node:test';
import assert from 'node:assert/strict';
import {repository,loadTheme,saveTheme} from '../src/lib/repository.ts';

function storage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
test('reintenta una operación incierta con el mismo identificador, incluso tras recargar el módulo',async()=>{
 globalThis.sessionStorage=storage();
 const original=globalThis.fetch;
 const sent=[];
 const mutation={action:'sale.create',payload:{method:'QR',items:[{productId:'PR-001',quantity:1,expectedPrice:20}]}};
 try{
   globalThis.fetch=async(_,options)=>{sent.push(JSON.parse(options.body));throw new Error('Conexión perdida');};
   await assert.rejects(()=>repository.execute(mutation),/no se duplicará/);
   const {repository:reloaded}=await import('../src/lib/repository.ts?reload');
   globalThis.fetch=async(_,options)=>{sent.push(JSON.parse(options.body));return Response.json({data:{products:[],sales:[],purchases:[],business:{}},resultId:'V-1'});};
   await reloaded.execute(mutation);
   assert.equal(sent[0].id,sent[1].id);
   await reloaded.execute(mutation);
   assert.notEqual(sent[1].id,sent[2].id,'una nueva venta intencional recibe otra identidad');
 }finally{globalThis.fetch=original;}
});
test('errores de API no se convierten en éxito y el tema sigue siendo local',async()=>{
 const original=globalThis.fetch;
 globalThis.localStorage=storage();
 try{
   globalThis.fetch=async()=>Response.json({error:'Stock insuficiente'},{status:409});
   await assert.rejects(()=>repository.load(),/Stock insuficiente/);
   globalThis.fetch=async()=>Response.json({data:null});
   await assert.rejects(()=>repository.load(),/confirmar la respuesta/);
   assert.equal(loadTheme(),'light');saveTheme('neon');assert.equal(loadTheme(),'neon');
   globalThis.localStorage.setItem('lacava-theme','invalid');globalThis.localStorage.setItem('lacava-v1','{"theme":"dark","products":[{}]}');
   assert.equal(loadTheme(),'dark');
 }finally{globalThis.fetch=original;}
});
