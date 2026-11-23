--Ejecutar después de 001. Conserva las copias existentes.
begin;
create or replace function public.guardar_copia_finanzas(revision_esperada bigint, nueva_copia jsonb)
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
       or coalesce(nueva_copia->>'version', '') not in ('7', '8')
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

revoke all on function public.guardar_copia_finanzas(bigint, jsonb) from public, anon;
grant execute on function public.guardar_copia_finanzas(bigint, jsonb) to authenticated;
commit;
