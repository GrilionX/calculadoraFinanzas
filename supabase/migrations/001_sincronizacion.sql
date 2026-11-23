--Cuenta y copia privada
begin;
create table public.finanzas_copias (
    usuario_id uuid primary key references auth.users(id) on delete cascade,
    revision bigint not null check (revision > 0),
    copia jsonb not null check (jsonb_typeof(copia) = 'object'),
    actualizado_en timestamptz not null default now()
);
alter table public.finanzas_copias enable row level security;
alter table public.finanzas_copias force row level security;
revoke all on public.finanzas_copias from anon, authenticated;
grant select on public.finanzas_copias to authenticated;
create policy leer_copia_propia on public.finanzas_copias
    for select to authenticated using ((select auth.uid()) = usuario_id);

--La escritura pasa por una comparación de revisión dentro de una transacción
create function public.guardar_copia_finanzas(revision_esperada bigint, nueva_copia jsonb)
returns table(revision bigint, actualizado_en timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
    usuario uuid := auth.uid();
begin
    if usuario is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if revision_esperada is null or revision_esperada < 0 or nueva_copia is null
       or jsonb_typeof(nueva_copia) is distinct from 'object'
       or nueva_copia->>'app' is distinct from 'finanzas-personal'
       or nueva_copia->>'version' is distinct from '7'
       or jsonb_typeof(nueva_copia->'datos') is distinct from 'object'
       or octet_length(nueva_copia::text) > 4000000 then
        raise exception 'Copia incompatible o demasiado grande' using errcode = '22023';
    end if;
    if revision_esperada = 0 then
        return query insert into public.finanzas_copias as f(usuario_id, revision, copia)
            values(usuario, 1, nueva_copia)
            on conflict (usuario_id) do nothing returning f.revision, f.actualizado_en;
    else
        return query update public.finanzas_copias as f
            set copia = nueva_copia, revision = f.revision + 1, actualizado_en = now()
            where f.usuario_id = usuario and f.revision = revision_esperada
            returning f.revision, f.actualizado_en;
    end if;
    if not found then raise exception 'La copia cambió: consulta la versión actual' using errcode = '40001'; end if;
end;
$$;
--Sin permisos directos de escritura y sin parámetro para elegir otro usuario
revoke all on function public.guardar_copia_finanzas(bigint, jsonb) from public, anon;
grant execute on function public.guardar_copia_finanzas(bigint, jsonb) to authenticated;
commit;
