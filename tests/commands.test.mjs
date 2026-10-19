import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCommand} from '../src/lib/commands.ts';
const id='00000000-0000-4000-8000-000000000001';
const product={name:'Producto',category:'Vinos',size:'750 ml',price:25.5,cost:10,stock:3,min:1};
test('valida operaciones admitidas y rechaza valores inválidos',()=>{
 assert.equal(validateCommand({id,action:'product.save',payload:product}).payload.price,25.5);
 for(const change of [{stock:1.5},{cost:-1},{price:NaN},{price:Infinity},{price:1.001},{stock:2147483648},{name:' '},{category:'Otra'},{id:'PR-1'}]){
   assert.throws(()=>validateCommand({id,action:'product.save',payload:{...product,...change}}));
 }
 for(const value of [null,[],{}, {id:'bad',action:'product.save',payload:product},{id,action:'data.replace',payload:{}}])assert.throws(()=>validateCommand(value));
});
test('ventas requieren cantidades positivas, precio esperado y método permitido',()=>{
 const item={productId:'PR-001',quantity:1,expectedPrice:20};
 assert.equal(validateCommand({id,action:'sale.create',payload:{method:'QR',items:[item]}}).action,'sale.create');
 for(const items of [[],[item,item],[{...item,quantity:0}],[{...item,quantity:1.1}],[{...item,expectedPrice:undefined}]])assert.throws(()=>validateCommand({id,action:'sale.create',payload:{method:'QR',items}}));
 assert.throws(()=>validateCommand({id,action:'sale.create',payload:{method:'Otro',items:[item]}}));
});
test('compras y configuración validan límites de formularios en servidor',()=>{
 const purchase={supplier:'Proveedor',reference:'',notes:'',date:'2026-10-12T12:00:00-04:00',items:[{productId:'PR-1',quantity:1,cost:10}]};
 assert.equal(validateCommand({id,action:'purchase.create',payload:purchase}).action,'purchase.create');
 assert.throws(()=>validateCommand({id,action:'purchase.create',payload:{...purchase,date:'inválida'}}));
 assert.throws(()=>validateCommand({id,action:'purchase.create',payload:{...purchase,notes:'a'.repeat(501)}}));
 const business={name:'Demo',legalName:'',nit:'',address:'Av. 123',branchAddress:'',city:'La Paz',phone:'',email:'',version:1};
 assert.equal(validateCommand({id,action:'business.save',payload:business}).action,'business.save');
 assert.throws(()=>validateCommand({id,action:'business.save',payload:{...business,version:0}}));
 assert.throws(()=>validateCommand({id,action:'business.save',payload:{...business,email:'bad'}}));
});
