-- Tabla de mensajes de chat por evento de transporte
CREATE TABLE IF NOT EXISTS mensajes_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES eventos_transporte(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  autor_nombre text NOT NULL,
  autor_foto text,
  autor_rol text NOT NULL DEFAULT 'miembro',
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_transporte_evento
  ON mensajes_transporte(evento_id, created_at);

ALTER TABLE mensajes_transporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden leer mensajes transporte"
  ON mensajes_transporte FOR SELECT USING (true);

CREATE POLICY "Autenticados pueden insertar mensajes transporte"
  ON mensajes_transporte FOR INSERT WITH CHECK (true);
