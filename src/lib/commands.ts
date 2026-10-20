import type {Business, Product} from './store';

export type ProductInput = Pick<Product,'name'|'category'|'size'|'price'|'cost'|'stock'|'min'> & {id?:string;version?:number};
export type SaleInput = {method:string;items:{productId:string;quantity:number;expectedPrice:number}[]};
export type PurchaseInput = {supplier:string;date:string;reference:string;notes:string;items:{productId:string;quantity:number;cost:number}[]};
export type Command =
 | {id:string;action:'product.save';payload:ProductInput}
 | {id:string;action:'sale.create';payload:SaleInput}
 | {id:string;action:'purchase.create';payload:PurchaseInput}
 | {id:string;action:'business.save';payload:Business & {version:number}};

const categories=['Cervezas','Vinos','Singanis','Whiskies','Vodkas','Rones','Sin alcohol'];
function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Solicitud inválida.');
 return value as Record<string,unknown>;
}
function text(value:unknown,label:string,max:number,required=true){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`${label}: valor inválido.`);
}
function number(value:unknown,label:string,integer=false,max=999999999999.99){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||(integer&&!Number.isInteger(value))||(!integer&&Math.abs(value*100-Math.round(value*100))>0.001))throw new Error(`${label}: valor inválido.`);
}
function positiveInteger(value:unknown,label:string){number(value,label,true,2147483647);if(value===0)throw new Error(`${label}: debe ser mayor que cero.`);}
export function validateCommand(value:unknown):Command{
 const command=object(value),p=object(command.payload);
 if(typeof command.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.id))throw new Error('Identificador de solicitud inválido.');
 switch(command.action){
 case 'product.save':
   text(p.name,'Nombre',120);text(p.size,'Presentación',80);
   if(!categories.includes(String(p.category)))throw new Error('Categoría inválida.');
   number(p.price,'Precio');number(p.cost,'Costo');number(p.stock,'Stock',true,2147483647);number(p.min,'Stock mínimo',true,2147483647);
   if(p.id!==undefined){text(p.id,'Producto',80);positiveInteger(p.version,'Versión');}
   break;
 case 'sale.create':
 case 'purchase.create':{
   if(!Array.isArray(p.items)||p.items.length<1||p.items.length>100)throw new Error('Agrega entre 1 y 100 productos.');
   const seen=new Set<string>();
   for(const raw of p.items){const item=object(raw);text(item.productId,'Producto',80);positiveInteger(item.quantity,'Cantidad');
     if(seen.has(item.productId as string))throw new Error('No repitas productos.');seen.add(item.productId as string);
     number(command.action==='sale.create'?item.expectedPrice:item.cost,'Precio o costo');
   }
   if(command.action==='sale.create'){
     if(!['QR','Efectivo','Tarjeta'].includes(String(p.method)))throw new Error('Método de pago inválido.');
   }else{
     text(p.supplier,'Proveedor',120);text(p.reference,'Referencia',80,false);text(p.notes,'Observaciones',500,false);
     text(p.date,'Fecha',40);
     if(!/^\d{4}-\d{2}-\d{2}T12:00:00-04:00$/.test(p.date as string)||!Number.isFinite(Date.parse(p.date as string))||new Date(p.date as string).toISOString().slice(0,10)!==(p.date as string).slice(0,10))throw new Error('Fecha inválida.');
   }
   break;
 }
 case 'business.save':
   for(const key of ['name','legalName','nit','address','branchAddress','city','phone','email'])text(p[key],key,key==='address'||key==='branchAddress'?250:120,['name','address','city'].includes(key));
   if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email)))throw new Error('Correo electrónico inválido.');
   positiveInteger(p.version,'Versión');break;
 default:throw new Error('Operación no permitida.');
 }
 return command as Command;
}
