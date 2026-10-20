import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {Data} from './store';
import {summarizeReport} from './reports.ts';

// Helvetica includes Spanish accents. Replace characters outside its encoding
// rather than emitting corrupt glyphs for pasted emoji or unsupported scripts.
const text=(value:string)=>value.normalize('NFC').replace(/[^\x20-\x7e\xa0-\xff\n]/g,' ');
const amount=(value:number)=>new Intl.NumberFormat('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)+' BOB';
const date=(value:string|Date)=>new Date(value).toLocaleString('es-BO',{timeZone:'America/La_Paz',dateStyle:'short',timeStyle:'short'});
export function createReportPdf(data:Data,days:number,now=new Date()){
 const report=summarizeReport(data,days,now);
 const doc=new jsPDF({format:'a4'});
 doc.setProperties({title:`Reporte de ${data.business.name}`,author:data.business.name,subject:`Últimos ${days} días`});
 let y=20;
 function paragraph(value:string,size=10){
  doc.setFontSize(size);const lines=doc.splitTextToSize(text(value),178);
  for(const line of lines){if(y>270){doc.addPage();y=20;}doc.text(line,16,y);y+=size*.45+2;}
 }
 paragraph(data.business.name,18);
 for(const value of [data.business.legalName,data.business.nit&&`NIT: ${data.business.nit}`,data.business.address,data.business.branchAddress&&`Sucursal: ${data.business.branchAddress}`,`${data.business.city}, Bolivia`,[data.business.phone,data.business.email].filter(Boolean).join(' | ')])if(value)paragraph(value);
 y+=4;paragraph('Reporte de ventas, compras e inventario',14);
 paragraph(`Período: ${date(new Date(now.getTime()-days*86400000))} a ${date(now)} (Bolivia)`);
 paragraph(`Generado: ${date(now)} | Moneda: BOB`);
 paragraph('Comprobante interno. Sin valor fiscal.',9);
 const table=(title:string,head:string[],body:(string|number)[][])=>{
  if(y>245){doc.addPage();y=20;}y+=5;paragraph(title,12);
  autoTable(doc,{startY:y,head:[head],body:body.length?body:[head.map((_,i)=>i===0?'Sin registros en este período.':'')],margin:{left:16,right:16,top:18,bottom:20},styles:{font:'helvetica',fontSize:8,overflow:'linebreak',cellPadding:2.5},headStyles:{fillColor:[91,73,145]},alternateRowStyles:{fillColor:[246,245,250]},rowPageBreak:'avoid'});
  y=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+6;
 };
 table('Resumen',['Indicador','Valor'],[['Ingresos',amount(report.revenue)],['Margen bruto',amount(report.profit)],['Ventas registradas',report.sales.length],['Compras recibidas',amount(report.purchaseTotal)],['Inventario actual a costo',amount(report.inventoryValue)]]);
 table('Ventas del período',['Venta','Fecha (Bolivia)','Método','Total'],report.sales.map(s=>[s.id,date(s.date),text(s.method),amount(s.total)]));
 table('Detalle de ventas',['Venta / producto','Cantidad','Precio unitario','Costo histórico','Subtotal'],report.sales.flatMap(s=>s.items.map(i=>[text(`${s.id}\n${i.name}`),i.quantity,amount(i.price),amount(i.cost),amount(i.quantity*i.price)])));
 table('Compras recibidas en el período',['Compra / proveedor','Fecha (Bolivia)','Referencia','Total'],report.purchases.map(p=>[text(`${p.id}\n${p.supplier}`),date(p.date),text(p.reference),amount(p.total)]));
 table('Inventario actual (al generar el reporte)',['Producto / presentación','Stock','Mínimo','Costo','Precio','Valor a costo'],data.products.map(p=>[text(`${p.name}\n${p.size}`),p.stock,p.min,amount(p.cost),amount(p.price),amount(p.stock*p.cost)]));
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFontSize(8);doc.setTextColor(100);doc.text('Reporte interno | BOB | America/La_Paz',16,286);doc.text(`${page} / ${pages}`,194,286,{align:'right'});}
 return doc;
}
export function downloadReportPdf(data:Data,days:number){
 const now=new Date();
 createReportPdf(data,days,now).save(`reporte-la-cava-${now.toISOString().slice(0,10)}-${days}dias.pdf`);
}
