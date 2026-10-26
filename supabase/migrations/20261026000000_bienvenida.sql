-- Correo de bienvenida de Peaje Pro (aparte del recibo que manda Paddle).
--
-- El webhook de Paddle lo manda una sola vez por negocio, con el primer cobro
-- de la suscripción. Antes de enviar marca welcome_sent_at con un update
-- condicional (solo si está en null): los reintentos de Paddle y los eventos
-- duplicados no mandan dos veces. Si Resend falla, el gateway vuelve a ponerlo
-- en null y el siguiente evento de esa suscripción (dentro de 3 días) reintenta.
alter table tenants add column if not exists welcome_sent_at timestamptz;
