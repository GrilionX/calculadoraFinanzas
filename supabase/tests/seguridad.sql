--Ejecutar en SQL Editor después de la migración. Todo se revierte.
begin;
insert into auth.users (id, email) values
('d8646ac2-01ae-42ec-8049-00ff70000001', 'finanzas-a@example.invalid'),
('d8646ac2-01ae-42ec-8049-00ff70000002', 'finanzas-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd8646ac2-01ae-42ec-8049-00ff70000001', true);
select * from public.guardar_copia_finanzas(0, '{"app":"finanzas-personal","version":7,"datos":{}}'::jsonb);
do $$
begin
    if (select count(*) from public.finanzas_copias) <> 1 then raise exception 'A no ve su copia'; end if;
    begin
        perform public.guardar_copia_finanzas(0, '{"app":"finanzas-personal","version":7,"datos":{}}'::jsonb);
        raise exception 'Se admitió una revisión antigua';
    exception when serialization_failure then null; end;
    begin
        perform public.guardar_copia_finanzas(1, '{"version":7}'::jsonb);
        raise exception 'Se admitió una copia incompatible';
    exception when invalid_parameter_value then null; end;
end $$;
select * from public.guardar_copia_finanzas(1, '{"app":"finanzas-personal","version":7,"datos":{}}'::jsonb);

select set_config('request.jwt.claim.sub', 'd8646ac2-01ae-42ec-8049-00ff70000002', true);
do $$
begin
    if exists(select 1 from public.finanzas_copias) then raise exception 'B puede ver datos de A'; end if;
    begin
        perform public.guardar_copia_finanzas(2, '{"app":"finanzas-personal","version":7,"datos":{}}'::jsonb);
        raise exception 'B actualizó una revisión de A';
    exception when serialization_failure then null; end;
    begin
        update public.finanzas_copias set revision = 100;
        raise exception 'Se permitió escritura directa';
    exception when insufficient_privilege then null; end;
    begin
        delete from public.finanzas_copias;
        raise exception 'Se permitió borrado directo';
    exception when insufficient_privilege then null; end;
end $$;
select * from public.guardar_copia_finanzas(0, '{"app":"finanzas-personal","version":7,"datos":{}}'::jsonb);
do $$
begin
    if (select count(*) from public.finanzas_copias) <> 1 then raise exception 'B ve más de una cuenta'; end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
    begin
        perform * from public.finanzas_copias;
        raise exception 'Un anónimo puede leer las copias';
    exception when insufficient_privilege then null; end;
    begin
        perform public.guardar_copia_finanzas(0, '{"app":"finanzas-personal","version":7,"datos":{}}'::jsonb);
        raise exception 'Un anónimo puede escribir';
    exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
