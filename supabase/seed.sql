-- OPCIONAL. Datos ficticios para una base de demostración.
-- Se puede repetir: no duplica operaciones ni sobrescribe productos existentes.
begin;
do $$
declare
 p record;
 v_id text;
 v_sale text;
 v_key uuid;
 i integer;
begin
 perform pg_advisory_xact_lock(726281934);
 for p in select * from (values
 ('PR-001','Huari Tradicional','Cervezas','620 ml',18,12,84,24,'#b07636'),
 ('PR-002','Campos de Solana Tinto','Vinos','750 ml',65,42,18,6,'#772d42'),
 ('PR-003','Casa Real Etiqueta Negra','Singanis','750 ml',85,58,7,10,'#d5aa62'),
 ('PR-004','Johnnie Walker Red Label','Whiskies','750 ml',155,112,12,5,'#9c642c'),
 ('PR-005','Paceña Pilsener','Cervezas','355 ml',10,6,120,30,'#a84c35'),
 ('PR-006','Absolut Original','Vodkas','750 ml',125,88,4,6,'#7395a8'),
 ('PR-007','Ron Flor de Caña 7 años','Rones','750 ml',145,98,15,5,'#895c3d'),
 ('PR-008','Coca-Cola','Sin alcohol','2 L',14,10,32,12,'#b33a36')
 ) as t(id,name,category,size,price,cost,stock,min,color) loop
   v_id:=null;
   insert into public.products(id,name,category,size,price,cost,stock,min,color)
   values(p.id,p.name,p.category,p.size,p.price,p.cost,p.stock,p.min,p.color)
   on conflict (id) do nothing returning id into v_id;
   if v_id is not null then
     insert into public.stock_movements(product_id,quantity,reason) values(v_id,p.stock,'opening');
   end if;
 end loop;
 -- Solo completar encabezado inicial; respetar la configuración guardada por el usuario.
 update public.business set legal_name='La Cava Demo S.R.L.',nit='0000000000',address='Av. Arce 123 · Datos ficticios',
   city='La Paz',phone='+591 70000000',email='demo@example.com' where id and version=1 and address='';
 if not exists(select 1 from public.command_receipts where id='10000000-0000-4000-8000-000000000001') then
 perform public.lacava_command('10000000-0000-4000-8000-000000000001','purchase.create',jsonb_build_object(
   'supplier','Distribuidora Andina · Demo','reference','DEMO-001','notes','Recepción de prueba',
   'date',to_char((now() at time zone 'America/La_Paz')::date-3,'YYYY-MM-DD')||'T12:00:00-04:00',
   'items',jsonb_build_array(jsonb_build_object('productId','PR-001','quantity',12,'cost',13),jsonb_build_object('productId','PR-002','quantity',6,'cost',44))));
 end if;
 for i in 0..23 loop
   v_key:=('20000000-0000-4000-8000-'||lpad((i+1)::text,12,'0'))::uuid;
   if not exists(select 1 from public.command_receipts where id=v_key) then
     select id,price into p from public.products where id='PR-'||lpad((i%8+1)::text,3,'0');
     -- Una unidad por operación para conservar existencias en todos los productos.
     v_sale:=public.lacava_command(v_key,'sale.create',jsonb_build_object('method',(array['QR','Efectivo','Tarjeta'])[i%3+1],
       'items',jsonb_build_array(jsonb_build_object('productId',p.id,'quantity',1,'expectedPrice',p.price))))->>'resultId';
     -- Fecha histórica solo para la operación recién creada por esta seed.
     update public.sales set date=now()-make_interval(days=>i/4,hours=>i%4) where id=v_sale;
     update public.stock_movements set created_at=(select date from public.sales where id=v_sale) where sale_id=v_sale;
   end if;
 end loop;
end $$;
commit;
