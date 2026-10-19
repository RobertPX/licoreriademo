-- Ejecutar solo en una base de pruebas con las migraciones aplicadas.
-- Todas las operaciones de esta prueba se revierten al terminar.
begin;
set local role service_role;
do $$
declare
 v_data jsonb;
 v_result jsonb;
 v_again jsonb;
 v_product text;
 v_sale text;
 v_cost numeric;
 v_id uuid:=gen_random_uuid();
 v_failed boolean;
 v_count bigint;
 v_version integer;
begin
 if has_function_privilege('anon','public.lacava_snapshot()','execute') or
    has_function_privilege('authenticated','public.lacava_command(uuid,text,jsonb)','execute') or
    has_table_privilege('anon','public.products','select') then
   raise exception 'FAIL: exposición de datos o funciones a clientes públicos';
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
   and c.relname in ('business','products','sales','sale_items','purchases','purchase_items','stock_movements','command_receipts') and not c.relrowsecurity) then
   raise exception 'FAIL: falta RLS';
 end if;
 v_result:=public.lacava_command(gen_random_uuid(),'product.save','{"name":"Producto de prueba","category":"Vinos","size":"750 ml","price":20,"cost":10,"stock":10,"min":2}');
 v_product:=v_result->>'resultId';
 if not exists(select 1 from jsonb_array_elements(v_result->'data'->'products') value where value->>'id'=v_product) then raise exception 'FAIL: snapshot no incluye el producto creado'; end if;
 v_result:=public.lacava_command(v_id,'purchase.create',jsonb_build_object('supplier','Proveedor prueba','date',now(),
   'items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',10,'cost',14))));
 select stock,cost,version into v_count,v_cost,v_version from public.products where id=v_product;
 if v_count<>20 or v_cost<>12 then raise exception 'FAIL: costo ponderado o stock incorrectos'; end if;
 v_again:=public.lacava_command(v_id,'purchase.create',jsonb_build_object('supplier','Proveedor prueba','date',now(),
   'items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',10,'cost',14))));
 if v_result->>'resultId'<>v_again->>'resultId' or (select stock from public.products where id=v_product)<>20 then raise exception 'FAIL: reintento duplicó compra'; end if;
 v_result:=public.lacava_command(gen_random_uuid(),'sale.create',jsonb_build_object('method','QR','total',0,
   'items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',3,'expectedPrice',20,'price',0,'cost',0))));
 v_sale:=v_result->>'resultId';
 if (select total from public.sales where id=v_sale)<>60 or (select stock from public.products where id=v_product)<>17 then raise exception 'FAIL: total o descuento de venta incorrectos'; end if;
 if (select cost from public.sale_items where sale_id=v_sale)<>12 then raise exception 'FAIL: costo histórico incorrecto'; end if;
 perform public.lacava_command(gen_random_uuid(),'purchase.create',jsonb_build_object('supplier','Otro proveedor','date',now(),
   'items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',1,'cost',100))));
 if (select cost from public.sale_items where sale_id=v_sale)<>12 then raise exception 'FAIL: compra alteró costo histórico'; end if;
 select count(*) into v_count from public.sales;
 v_failed:=false;
 begin
   perform public.lacava_command(gen_random_uuid(),'sale.create',jsonb_build_object('method','QR','items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',999,'expectedPrice',20))));
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed or (select count(*) from public.sales)<>v_count or (select stock from public.products where id=v_product)<>18 then raise exception 'FAIL: venta sin stock no fue atómica'; end if;
 v_failed:=false;
 begin
   perform public.lacava_command(gen_random_uuid(),'sale.create',jsonb_build_object('method','QR','items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',1,'expectedPrice',1))));
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed then raise exception 'FAIL: aceptó precio desactualizado'; end if;
 v_failed:=false;
 begin
   perform public.lacava_command(gen_random_uuid(),'product.save',jsonb_build_object('id',v_product,'version',v_version,'name','Sobrescribir','category','Vinos','size','750 ml','price',20,'cost',10,'stock',50,'min',2));
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed then raise exception 'FAIL: edición obsoleta sobrescribió stock'; end if;
 v_failed:=false;
 begin
   perform public.lacava_command(v_id,'sale.create','{}');
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed then raise exception 'FAIL: reutilizó identificador con otro comando'; end if;
 v_failed:=false;
 begin
   perform public.lacava_command(gen_random_uuid(),'purchase.create',jsonb_build_object('supplier','Proveedor','date',now()+interval '2 days','items',jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',1,'cost',1))));
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed then raise exception 'FAIL: recibió compra futura'; end if;
 v_data:=public.lacava_snapshot();
 if jsonb_typeof(v_data->'products')<>'array' or v_data->'business'->>'name' is null then raise exception 'FAIL: snapshot inválido'; end if;
 if (select sum(quantity) from public.stock_movements where product_id=v_product)<>(select stock from public.products where id=v_product) then raise exception 'FAIL: movimientos no cuadran con inventario'; end if;
 select count(*) into v_count from public.purchases;
 v_failed:=false;
 begin
   perform public.lacava_command(gen_random_uuid(),'purchase.create',jsonb_build_object('supplier','Proveedor','date',now(),'items',jsonb_build_array(
     jsonb_build_object('productId',v_product,'quantity',1,'cost',1),jsonb_build_object('productId','ZZZ-inexistente','quantity',1,'cost',1))));
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed or (select count(*) from public.purchases)<>v_count or (select stock from public.products where id=v_product)<>18 then raise exception 'FAIL: compra de varios productos no fue atómica'; end if;
 select version into v_version from public.business where id;
 v_result:=public.lacava_command(gen_random_uuid(),'business.save',jsonb_build_object('name','Negocio actualizado','legalName','','nit','','address','Av. Bolivia','branchAddress','','city','La Paz','phone','','email','','version',v_version));
 if v_result->'data'->'business'->>'name'<>'Negocio actualizado' or (v_result->'data'->>'businessVersion')::integer<>v_version+1 then raise exception 'FAIL: configuración no se guardó'; end if;
 v_failed:=false;
 begin
   perform public.lacava_command(gen_random_uuid(),'business.save',jsonb_build_object('version',v_version));
 exception when raise_exception then v_failed:=true;
 end;
 if not v_failed then raise exception 'FAIL: configuración obsoleta fue aceptada'; end if;
end $$;
select 'PASS: transacciones, stock, costos, reintentos, versiones, RLS y permisos' as result;
rollback;
