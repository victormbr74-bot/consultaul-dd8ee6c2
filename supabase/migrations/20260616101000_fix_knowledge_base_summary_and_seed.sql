CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  summary TEXT,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE INDEX IF NOT EXISTS knowledge_base_updated_at_idx
  ON public.knowledge_base (updated_at DESC);

DROP INDEX IF EXISTS knowledge_base_title_idx;
CREATE INDEX IF NOT EXISTS knowledge_base_search_idx
  ON public.knowledge_base USING gin (
    to_tsvector(
      'portuguese',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, '')
    )
  );

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read knowledge base" ON public.knowledge_base;
CREATE POLICY "Authenticated can read knowledge base"
  ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert knowledge base" ON public.knowledge_base;
CREATE POLICY "Authenticated can insert knowledge base"
  ON public.knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "Owners and admins can update knowledge base" ON public.knowledge_base;
CREATE POLICY "Owners and admins can update knowledge base"
  ON public.knowledge_base
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners and admins can delete knowledge base" ON public.knowledge_base;
CREATE POLICY "Owners and admins can delete knowledge base"
  ON public.knowledge_base
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL OR public.has_role(auth.uid(), 'admin'));

DO $$
DECLARE
  v_title TEXT := 'Fluxo de acionamento - Brisanet';
  v_category TEXT := 'Operadora';
  v_summary TEXT := 'Fluxo curto para abertura, registro e escalonamento de chamados Brisanet, incluindo CNPJ por tipo de circuito, canais N1 e contatos de escalonamento.';
  v_content TEXT := 'Resumo:
Fluxo curto para abertura, registro e escalonamento de chamados Brisanet.

Contexto: Mascara, Backup 4G, VSAT, Operadora 4G
Operadora: BRISANET
Tipo: Abertura e escalonamento
Gatilhos: brisanet, abertura, chamado, vsat, 4g, operadora 4g, circuito backup, jira

Procedimento:
1. Identifique o cliente antes da abertura:
   - Circuitos SENCINET: CNPJ 33.179.565/0001-37.
   - Circuitos migrados para OI: CNPJ 76.535.764/0022-78.
2. Acione o Nivel 1 pelos canais da Brisanet:
   - NOC: 0800 282 3017.
   - Fixo: (88) 2150-0923.
   - WhatsApp: (88) 98182-0137.
   - E-mail: suportecorporativon2@grupobrisanet.com.br.
3. No WhatsApp, informe o CNPJ do cliente.
4. Selecione a opcao "Outro Endereco".
5. Selecione a opcao "Conectividade".
6. Informe ao analista o numero da designacao Brisanet.
7. Solicite a abertura do chamado.
8. Registre o numero do chamado no JIRA.
9. Se houver demora ou falta de atualizacao, escale na ordem:
   - Nivel 2 Supervisor: Carlos Henrique, (84) 98856-8833, carlos.vitor@grupobrisanet.com.br.
   - Nivel 3 Especialista: Felipy Santana, (84) 98800-3660, felipy.pinheiro@grupobrisanet.com.br.
   - Nivel 3 Especialista: Anderson Lucas, (88) 99471-9648, lucas.bezerra@grupobrisanet.com.br.
   - Nivel 4 Coordenador: Vinicius Lopes, (84) 98209-5471, viniciuslopes@grupobrisanet.com.br.
   - Nivel 5 Gerente: Paulo Cesar, (84) 98159-2860, paulocesaralves@grupobrisanet.com.br.
10. Sempre registre no JIRA o protocolo gerado pela Brisanet e o nivel de escalonamento acionado.';
  v_tags TEXT[] := ARRAY[
    'brisanet',
    'operadora',
    'abertura',
    'chamado',
    'vsat',
    '4g',
    'operadora 4g',
    'circuito backup',
    'jira',
    'mascara'
  ];
BEGIN
  UPDATE public.knowledge_base
  SET
    category = v_category,
    summary = v_summary,
    content = v_content,
    tags = v_tags,
    updated_at = now()
  WHERE lower(title) = lower(v_title);

  IF NOT FOUND THEN
    INSERT INTO public.knowledge_base (title, category, summary, content, tags, created_by, updated_at)
    VALUES (v_title, v_category, v_summary, v_content, v_tags, NULL, now());
  END IF;
END $$;
