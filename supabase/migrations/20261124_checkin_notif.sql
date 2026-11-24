-- ── Check-in automático por chat ────────────────────────────────────
-- 1) Extender mensajes_directos para mensajes de sistema (checkin)
ALTER TABLE mensajes_directos
  ADD COLUMN IF NOT EXISTS tipo      text NOT NULL DEFAULT 'dm',
  ADD COLUMN IF NOT EXISTS metadata  jsonb;

-- Índice para buscar rápido los mensajes de checkin de un usuario
CREATE INDEX IF NOT EXISTS idx_mensajes_directos_tipo
  ON mensajes_directos(destinatario_id, tipo)
  WHERE tipo = 'checkin';

-- 2) Flag en eventos_transporte para no reenviar la notificación
ALTER TABLE eventos_transporte
  ADD COLUMN IF NOT EXISTS checkin_notif_enviada boolean NOT NULL DEFAULT false;

-- 3) Permitir remitente_id nulo (mensajes de sistema no tienen usuario remitente)
ALTER TABLE mensajes_directos
  ALTER COLUMN remitente_id DROP NOT NULL;

-- 4) RLS: los mensajes de checkin también son legibles por el destinatario
--    (la policy existente ya cubre esto si usa destinatario_id = auth.uid())
--    Solo agregamos política de INSERT para service_role (ya existe por defecto)
