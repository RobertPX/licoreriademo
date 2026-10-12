export type Product = {id:string;name:string;category:string;size:string;price:number;cost:number;stock:number;min:number;color:string};
export type Sale = {id:string;date:string;items:{productId:string;name:string;quantity:number;price:number;cost:number}[];method:string;total:number};
export type Theme = 'light'|'dark'|'neon';
export type Business = {name:string;legalName:string;nit:string;address:string;branchAddress:string;city:string;phone:string;email:string};
export type Purchase = {id:string;date:string;supplier:string;reference:string;notes:string;items:{productId:string;name:string;quantity:number;cost:number}[];total:number};
export type Data = {products:Product[];sales:Sale[];purchases:Purchase[];business:Business;theme:Theme};
export const defaultBusiness:Business={name:'Licorería La Cava',legalName:'',nit:'',address:'',branchAddress:'',city:'La Paz',phone:'',email:''};
export const money=(n:number)=>new Intl.NumberFormat('es-BO',{style:'currency',currency:'BOB',maximumFractionDigits:2}).format(n);
export const day=(date:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function seed():Data { const products:Product[]=[
{id:'PR-001',name:'Huari Tradicional',category:'Cervezas',size:'620 ml',price:18,cost:12,stock:84,min:24,color:'#b07636'},
{id:'PR-002',name:'Campos de Solana Tinto',category:'Vinos',size:'750 ml',price:65,cost:42,stock:18,min:6,color:'#772d42'},
{id:'PR-003',name:'Casa Real Etiqueta Negra',category:'Singanis',size:'750 ml',price:85,cost:58,stock:7,min:10,color:'#d5aa62'},
{id:'PR-004',name:'Johnnie Walker Red Label',category:'Whiskies',size:'750 ml',price:155,cost:112,stock:12,min:5,color:'#9c642c'},
{id:'PR-005',name:'Paceña Pilsener',category:'Cervezas',size:'355 ml',price:10,cost:6,stock:120,min:30,color:'#a84c35'},
{id:'PR-006',name:'Absolut Original',category:'Vodkas',size:'750 ml',price:125,cost:88,stock:4,min:6,color:'#7395a8'},
{id:'PR-007',name:'Ron Flor de Caña 7 años',category:'Rones',size:'750 ml',price:145,cost:98,stock:15,min:5,color:'#895c3d'},
{id:'PR-008',name:'Coca-Cola',category:'Sin alcohol',size:'2 L',price:14,cost:10,stock:32,min:12,color:'#b33a36'}];
const sales:Sale[]=Array.from({length:24},(_,i)=>{const p=products[i%products.length];const date=new Date();date.setDate(date.getDate()-Math.floor(i/4));date.setHours(10+i%10,12+i,0,0);const quantity=i%3+1;return {id:`V-${String(1024-i).padStart(5,'0')}`,date:date.toISOString(),items:[{productId:p.id,name:p.name,quantity,price:p.price,cost:p.cost}],method:['QR','Efectivo','Tarjeta'][i%3],total:p.price*quantity}});return {products,sales,purchases:[],business:{...defaultBusiness},theme:'light'};}
// Reemplazar este repositorio por un adaptador Supabase; la UI consume el mismo contrato.
export const repository={load():Data {const raw=localStorage.getItem('lacava-v1');if(raw){const data=JSON.parse(raw);if(Array.isArray(data.products)&&Array.isArray(data.sales))return {...data,purchases:Array.isArray(data.purchases)?data.purchases:[],business:{...defaultBusiness,...data.business},theme:['light','dark','neon'].includes(data.theme)?data.theme:'light'};}return seed();},save(data:Data){localStorage.setItem('lacava-v1',JSON.stringify(data));}};

export function receivePurchase(data:Data, input:Omit<Purchase,'id'|'total'>):Data {
 if(!input.supplier.trim()||!Number.isFinite(new Date(input.date).getTime())||!input.items.length)throw new Error('Completa el proveedor, la fecha y al menos un producto.');
 const seen=new Set<string>();
 for(const item of input.items){if(seen.has(item.productId)||!data.products.some(p=>p.id===item.productId)||!Number.isSafeInteger(item.quantity)||item.quantity<=0||!Number.isFinite(item.cost)||item.cost<0)throw new Error('Revisa los productos, cantidades y costos de la compra.');seen.add(item.productId);}
 const total=Math.round(input.items.reduce((sum,item)=>sum+item.quantity*item.cost,0)*100)/100;
 if(!Number.isFinite(total))throw new Error('El total de la compra no es válido.');
 const purchase:Purchase={...input,supplier:input.supplier.trim(),id:`C-${crypto.randomUUID().slice(0,8).toUpperCase()}`,total,items:input.items.map(item=>({...item,name:data.products.find(p=>p.id===item.productId)!.name}))};
 return {...data,purchases:[purchase,...data.purchases],products:data.products.map(p=>{const item=purchase.items.find(i=>i.productId===p.id);if(!item)return p;const stock=p.stock+item.quantity;if(!Number.isSafeInteger(stock))throw new Error('La cantidad ingresada es demasiado grande.');return {...p,stock,cost:Math.round((p.stock*p.cost+item.quantity*item.cost)/stock*100)/100};})};
}
