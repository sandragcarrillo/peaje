-- Un usuario (privy_user_id) puede tener varios negocios: los índices de
-- email y privy_user_id dejan de ser únicos. La sesión del dashboard pasa a
-- identificar al usuario, no a un tenant.

drop index if exists tenants_email_idx;
drop index if exists tenants_privy_user_id_idx;

create index if not exists tenants_email_idx on tenants (email) where email is not null;
create index if not exists tenants_privy_user_id_idx on tenants (privy_user_id) where privy_user_id is not null;
