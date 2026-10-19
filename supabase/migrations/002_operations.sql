begin;
-- Una sola consulta produce una vista consistente de todos los datos.
create function public.lacava_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'size',p.size,'price',p.price,'cost',p.cost,'stock',p.stock,'min',p.min,'color',p.color,'version',p.version) order by p.created_at,p.id) from public.products p),'[]'::jsonb),
 'sales',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.date,'method',s.method,'total',s.total,'items',(select jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.name,'quantity',i.quantity,'price',i.price,'cost',i.cost) order by i.product_id) from public.sale_items i where i.sale_id=s.id)) order by s.date desc,s.id) from public.sales s),'[]'::jsonb),
 'purchases',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'date',p.date,'supplier',p.supplier,'reference',p.reference,'notes',p.notes,'total',p.total,'items',(select jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.name,'quantity',i.quantity,'cost',i.cost) order by i.product_id) from public.purchase_items i where i.purchase_id=p.id)) order by p.date desc,p.id) from public.purchases p),'[]'::jsonb),
 'business',(select jsonb_build_object('name',b.name,'legalName',b.legal_name,'nit',b.nit,'address',b.address,'branchAddress',b.branch_address,'city',b.city,'phone',b.phone,'email',b.email) from public.business b where b.id),
 'businessVersion',(select version from public.business where id),
 'theme','light');
$$;

create function public.lacava_command(p_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
 v_previous public.command_receipts%rowtype;
 v_product public.products%rowtype;
 v_item jsonb;
 v_id text;
 v_quantity integer;
 v_cost numeric;
 v_total numeric := 0;
 v_old_stock integer;
 v_date timestamptz;
begin
 -- Serializa escrituras de esta única tienda, incluyendo comandos repetidos.
 -- El bloqueo se libera automáticamente al terminar o fallar la transacción.
 perform pg_advisory_xact_lock(726281934);
 if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
   raise exception 'Solicitud inválida.';
 end if;
 select * into v_previous from public.command_receipts where id=p_id;
 if found then
   if v_previous.action<>p_action or v_previous.payload<>p_payload then
     raise exception 'La solicitud ya se usó para otra operación.';
   end if;
   return jsonb_build_object('data',public.lacava_snapshot(),'resultId',v_previous.result_id);
 end if;

 if p_action='product.save' then
   if p_payload->>'id' is not null then
     select * into v_product from public.products where id=p_payload->>'id' for update;
     if not found then raise exception 'El producto ya no existe.'; end if;
     if v_product.version is distinct from (p_payload->>'version')::integer then
       raise exception 'El producto cambió en otra sesión. Actualiza antes de editar.';
     end if;
     v_old_stock := v_product.stock;
     update public.products set name=trim(p_payload->>'name'),category=p_payload->>'category',size=trim(p_payload->>'size'),
       price=(p_payload->>'price')::numeric,cost=(p_payload->>'cost')::numeric,stock=(p_payload->>'stock')::integer,
       min=(p_payload->>'min')::integer,version=version+1,updated_at=now()
       where id=v_product.id returning id into v_id;
   else
     v_old_stock := 0;
     insert into public.products(name,category,size,price,cost,stock,min)
       values(trim(p_payload->>'name'),p_payload->>'category',trim(p_payload->>'size'),(p_payload->>'price')::numeric,
       (p_payload->>'cost')::numeric,(p_payload->>'stock')::integer,(p_payload->>'min')::integer) returning id into v_id;
   end if;
   v_quantity := (p_payload->>'stock')::integer-v_old_stock;
   if v_quantity<>0 then
     insert into public.stock_movements(product_id,quantity,reason) values(v_id,v_quantity,case when p_payload->>'id' is null then 'opening' else 'adjustment' end);
   end if;
 elsif p_action in ('sale.create','purchase.create') then
   if jsonb_typeof(p_payload->'items') is distinct from 'array' then raise exception 'Agrega productos.'; end if;
   if jsonb_array_length(p_payload->'items') not between 1 and 100 then raise exception 'Agrega entre 1 y 100 productos.'; end if;
   if (select count(*)<>count(distinct value->>'productId') from jsonb_array_elements(p_payload->'items')) then
     raise exception 'No repitas productos en la misma operación.';
   end if;
   if p_action='sale.create' then
     insert into public.sales(method,total) values(p_payload->>'method',0) returning id into v_id;
   else
     v_date := (p_payload->>'date')::timestamptz;
     if v_date is null or not isfinite(v_date) or (v_date at time zone 'America/La_Paz')::date>(now() at time zone 'America/La_Paz')::date then
       raise exception 'La fecha de recepción no es válida o está en el futuro.';
     end if;
     insert into public.purchases(date,supplier,reference,notes,total)
       values(v_date,trim(p_payload->>'supplier'),coalesce(p_payload->>'reference',''),coalesce(p_payload->>'notes',''),0) returning id into v_id;
   end if;
   for v_item in select value from jsonb_array_elements(p_payload->'items') order by value->>'productId' loop
     v_quantity := (v_item->>'quantity')::integer;
     if v_quantity is null or v_quantity<=0 then raise exception 'Cantidad inválida.'; end if;
     select * into v_product from public.products where id=v_item->>'productId' for update;
     if not found then raise exception 'Uno de los productos ya no existe.'; end if;
     if p_action='sale.create' then
       if v_product.stock<v_quantity then raise exception 'Stock insuficiente para %. Actualiza el pedido.',v_product.name; end if;
       if v_product.price is distinct from (v_item->>'expectedPrice')::numeric then
         raise exception 'El precio de % cambió. Actualiza el pedido.',v_product.name;
       end if;
       insert into public.sale_items(sale_id,product_id,name,quantity,price,cost)
         values(v_id,v_product.id,v_product.name,v_quantity,v_product.price,v_product.cost);
       update public.products set stock=stock-v_quantity,version=version+1,updated_at=now() where id=v_product.id;
       insert into public.stock_movements(product_id,quantity,reason,sale_id) values(v_product.id,-v_quantity,'sale',v_id);
       v_total := v_total+v_quantity*v_product.price;
     else
       v_cost := (v_item->>'cost')::numeric;
       if v_cost is null or v_cost<0 or v_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'Costo inválido.'; end if;
       v_cost := round(v_cost,2);
       insert into public.purchase_items(purchase_id,product_id,name,quantity,cost) values(v_id,v_product.id,v_product.name,v_quantity,v_cost);
       update public.products set cost=round((stock*cost+v_quantity::numeric*v_cost)/(stock::numeric+v_quantity),2),
         stock=stock+v_quantity,version=version+1,updated_at=now() where id=v_product.id;
       insert into public.stock_movements(product_id,quantity,reason,purchase_id) values(v_product.id,v_quantity,'purchase',v_id);
       v_total := v_total+v_quantity*v_cost;
     end if;
   end loop;
   if p_action='sale.create' then update public.sales set total=v_total where id=v_id;
   else update public.purchases set total=v_total where id=v_id; end if;
 elsif p_action='business.save' then
   if not exists(select 1 from public.business where id and version=(p_payload->>'version')::integer) then
     raise exception 'La configuración cambió en otra sesión. Actualiza antes de guardar.';
   end if;
   if length(trim(p_payload->>'address'))=0 then raise exception 'Completa la dirección principal.'; end if;
   update public.business set name=trim(p_payload->>'name'),legal_name=p_payload->>'legalName',nit=p_payload->>'nit',
     address=trim(p_payload->>'address'),branch_address=p_payload->>'branchAddress',city=trim(p_payload->>'city'),
     phone=p_payload->>'phone',email=p_payload->>'email',version=version+1 where id;
   v_id := 'business';
 else
   raise exception 'Operación no permitida.';
 end if;
 insert into public.command_receipts(id,action,payload,result_id) values(p_id,p_action,p_payload,v_id);
 return jsonb_build_object('data',public.lacava_snapshot(),'resultId',v_id);
end;
$$;
revoke all on function public.lacava_snapshot() from public,anon,authenticated;
revoke all on function public.lacava_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.lacava_snapshot() to service_role;
grant execute on function public.lacava_command(uuid,text,jsonb) to service_role;
commit;
