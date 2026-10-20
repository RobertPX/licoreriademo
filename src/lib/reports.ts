import type {Data, Sale} from './store';

export function reportSales(sales:Sale[], days:number, now=new Date()):Sale[]{
 const end=now.getTime();
 const start=end-days*86400000;
 return sales.filter(sale=>{const date=Date.parse(sale.date);return date>=start&&date<=end;});
}
export function summarizeReport(data:Data, days:number, now=new Date()){
 const sales=reportSales(data.sales,days,now);
 const purchases=data.purchases.filter(p=>{const date=Date.parse(p.date);return date>=now.getTime()-days*86400000&&date<=now.getTime();});
 return {sales,purchases,revenue:sales.reduce((sum,s)=>sum+s.total,0),
 profit:sales.reduce((sum,s)=>sum+s.items.reduce((n,i)=>n+(i.price-i.cost)*i.quantity,0),0),
 inventoryValue:data.products.reduce((sum,p)=>sum+p.stock*p.cost,0),
 purchaseTotal:purchases.reduce((sum,p)=>sum+p.total,0)};
}
export function salesCsv(sales:Sale[]){
 const cell=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`;
 return '\ufeff'+[['Venta','Fecha','Método','Total BOB'],...sales.map(s=>[s.id,s.date,s.method,s.total.toFixed(2)])].map(row=>row.map(cell).join(';')).join('\r\n');
}
