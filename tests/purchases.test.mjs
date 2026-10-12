import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,receivePurchase,repository,defaultBusiness} from '../src/lib/store.ts';

const input={supplier:'Proveedor demo',reference:'F-123',notes:'Recepción completa',date:'2026-10-12T12:00:00-04:00'};
test('recibir varios productos incrementa stock y pondera costo sin alterar ventas históricas',()=>{
 const before=seed();const first=before.products[0],second=before.products[1];
 const after=receivePurchase(before,{...input,items:[{productId:first.id,name:'',quantity:6,cost:15},{productId:second.id,name:'',quantity:2,cost:50}]});
 assert.equal(after.products[0].stock,first.stock+6);
 assert.equal(after.products[0].cost,Math.round((first.stock*first.cost+90)/(first.stock+6)*100)/100);
 assert.equal(after.products[1].stock,second.stock+2);
 assert.equal(after.products[0].price,first.price);
 assert.deepEqual(after.sales,before.sales);
 assert.equal(after.purchases[0].total,190);
 assert.equal(after.purchases[0].items[0].name,first.name);
 assert.equal(before.purchases.length,0);
 assert.equal(before.products[0].stock,first.stock);
});
test('rechaza compras inválidas sin modificar existencias',()=>{
 const data=seed(),original=structuredClone(data),item={productId:data.products[0].id,name:'',quantity:1,cost:10};
 for(const items of [[],[{...item,quantity:0}],[{...item,quantity:1.5}],[{...item,cost:-1}],[{...item,cost:NaN}],[{...item,productId:'missing'}],[item,item]])assert.throws(()=>receivePurchase(data,{...input,items}));
 assert.throws(()=>receivePurchase(data,{...input,supplier:' ',items:[item]}));
 assert.deepEqual(data,original);
});
test('migra datos anteriores y conserva compras, negocio y tema al guardar',()=>{
 const original=seed();let raw=JSON.stringify({products:original.products,sales:original.sales});
 globalThis.localStorage={getItem:()=>raw,setItem:(_,value)=>{raw=value}};
 const migrated=repository.load();assert.deepEqual(migrated.purchases,[]);assert.equal(migrated.theme,'light');assert.deepEqual(migrated.business,defaultBusiness);assert.deepEqual(migrated.sales,original.sales);
 const data=receivePurchase(migrated,{...input,items:[{productId:original.products[0].id,name:'',quantity:3,cost:11}]});data.theme='neon';data.business.name='Mi licorería';data.business.address='Av. Bolivia 123';
 repository.save(data);assert.deepEqual(repository.load(),data);
});
