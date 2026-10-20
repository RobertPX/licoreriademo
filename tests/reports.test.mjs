import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReport,salesCsv} from '../src/lib/reports.ts';
import {createReportPdf} from '../src/lib/pdf.ts';
import {validateCommand} from '../src/lib/commands.ts';
const now=new Date('2026-10-20T16:00:00Z');
const sale={id:'V-1',date:now.toISOString(),method:'QR',total:40,items:[{productId:'PR-1',name:'Viña Peñón',quantity:2,price:20,cost:12}]};
const data={products:[{id:'PR-1',name:'Viña Peñón',size:'750 ml',category:'Vinos',price:20,cost:12,stock:5,min:2,color:'#772d42',version:1}],sales:[sale,{...sale,id:'future',date:'2026-10-21T16:00:00Z'},{...sale,id:'old',date:'2026-10-01T16:00:00Z'}],purchases:[],business:{name:'Licorería Peñón',legalName:'Negocio de prueba',nit:'123',address:'Av. Bolivia',branchAddress:'',city:'La Paz',phone:'',email:''},businessVersion:1,theme:'neon'};
test('reporte excluye fechas futuras y antiguas y conserva margen histórico',()=>{
 const report=summarizeReport(data,7,now);
 assert.deepEqual(report.sales.map(s=>s.id),['V-1']);assert.equal(report.revenue,40);assert.equal(report.profit,16);assert.equal(report.inventoryValue,60);
});
test('CSV escapa delimitadores y comillas y conserva dos decimales',()=>{
 const csv=salesCsv([{...sale,id:'V;"1'}]);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"V;""1"'));assert.ok(csv.includes('"40.00"'));
});
test('PDF vacío y multipágina se generan con encabezados y paginación',()=>{
 const empty=createReportPdf({...data,products:[],sales:[]},7,now);assert.ok(empty.output().startsWith('%PDF-'));assert.ok(empty.output().includes('Sin registros'));
 const many=createReportPdf({...data,sales:Array.from({length:120},(_,i)=>({...sale,id:`V-${i}`}))},7,now);
 assert.ok(many.getNumberOfPages()>3);const output=many.output();assert.ok(output.includes('Reporte interno'));assert.ok(output.includes(`${many.getNumberOfPages()} / ${many.getNumberOfPages()}`));
});
test('compras rechazan días inexistentes y aceptan año bisiesto',()=>{
 const command={id:'00000000-0000-4000-8000-000000000001',action:'purchase.create',payload:{supplier:'Proveedor',reference:'',notes:'',date:'2026-02-31T12:00:00-04:00',items:[{productId:'PR-1',quantity:1,cost:10}]}};
 assert.throws(()=>validateCommand(command),/Fecha inválida/);
 assert.doesNotThrow(()=>validateCommand({...command,payload:{...command.payload,date:'2024-02-29T12:00:00-04:00'}}));
 assert.throws(()=>validateCommand({...command,payload:{...command.payload,date:'2025-02-29T12:00:00-04:00'}}));
});
