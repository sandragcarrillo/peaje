-- Un chat de Telegram puede tener varios negocios (el dueño de dos sitios),
-- con uno activo: a ese le habla el chat. Antes conectar el segundo pisaba al
-- primero sin avisar.
alter table telegram_links drop constraint if exists telegram_links_pkey;
alter table telegram_links add primary key (chat_id, tenant_id);
alter table telegram_links add column if not exists active boolean not null default true;
