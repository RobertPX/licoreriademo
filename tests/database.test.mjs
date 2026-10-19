import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('PostgreSQL: migraciones, seed repetible y operaciones con permisos service_role',()=>{
 const configured=process.env.PG_BIN;
 const detected=spawnSync('pg_config',['--bindir'],{encoding:'utf8'});
 const bin=configured||detected.stdout?.trim();
 assert.ok(bin,'Instala PostgreSQL o configura PG_BIN para ejecutar npm run test:db.');
 const dir=mkdtempSync(join(tmpdir(),'lacava-db-test-'));
 try{
   const initialized=spawnSync(join(bin,'initdb'),['-D',dir,'-A','trust','--no-locale','-E','UTF8'],{encoding:'utf8',timeout:30000});
   assert.equal(initialized.status,0,initialized.stderr);
   const root=new URL('../',import.meta.url);
   const sql=['create role anon; create role authenticated; create role service_role bypassrls;'];
   for(const file of ['supabase/migrations/001_schema.sql','supabase/migrations/002_operations.sql','supabase/seed.sql','supabase/seed.sql','tests/database.sql']){
     sql.push(readFileSync(new URL(file,root),'utf8').split('\n').filter(line=>line.trim()).join('\n'));
   }
   sql.splice(sql.length-1,0,"do $$ begin if (select count(*) from public.products)<>8 or (select count(*) from public.sales)<>24 or (select count(*) from public.purchases)<>1 then raise exception 'FAIL: seed duplicada o incompleta'; end if; end $$;");
   // El modo single-user ejecuta SQL real sin abrir puertos ni necesitar Docker.
   const script=join(dir,'checks.sql');
   writeFileSync(script,sql.join('\n\n')+'\n\n');
   const input=openSync(script,'r');
   let result;
   try{result=spawnSync(join(bin,'postgres'),['--single','-j','-D',dir,'postgres'],{stdio:[input,'pipe','pipe'],encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});}finally{closeSync(input);}
   const output=result.stdout+result.stderr;
   assert.equal(result.status,0,output);
   assert.doesNotMatch(output,/ERROR:|FATAL:|PANIC:/,output);
   assert.match(output,/PASS: transacciones/,output);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
