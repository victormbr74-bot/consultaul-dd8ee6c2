## Auditoria atual vs regra

Boa parte da regra **já está implementada e correta** no módulo. Não vou tocar no que está conforme.

### Já conformes (não mexer)
- Janela fixa 15 min e gatilhos 5/5/15/50 (`massiva-processor.ts`).
- Separação VTAL ≠ OEMP no PRINCIPAL, agrupado por `operadora|uf`.
- Coexistência SECUNDARIO UF + SECUNDARIO NACIONAL.
- Identificação do PRINCIPAL via Extração Planta (designação / loopback / código).
- Identificação do SECUNDARIO via Extração Planta usando `operadora` (coluna E) → campo Operadora e `operadora_4g` (coluna AJ) → Tipo Emp. (`operadoras.ts` linhas 49-57).
- Máscara: INC vindo da coluna `Chamado`, Caso Pai com `CEF` removido, `Tipo` só PRINCIPAL/SECUNDARIO, sem operadora, listando apenas isoladas, `Chamado interno` vazio (`mascara.ts`).
- Geo apenas informativa (`applyGeoAnalysis` em `massiva-processor.ts`), epicentro pela cidade da GIS com mais circuitos, Haversine, classificações DENTRO/PARCIAL/FORA/SEM_GEO.

### Divergências a corrigir

**1. Fallback de identificação do SECUNDARIO via tabela `lotericas`** (`massiva-processor.ts` → `identifyFromLotericas`)
   - Hoje: para secundário define `operadora = operadora_4g` e `tipoEmp = operadora_4g` (mesma coisa), perdendo a distinção da regra item 9.
   - Corrigir: quando for SECUNDARIO no fallback, manter `operadora` = coluna `operadora` da lotérica e `tipoEmp` = `OPERADORA 4G` do `raw_data`, espelhando a regra da Extração Planta.

**2. Rótulo "SECUNDÁRIO" na máscara** (`mascara.ts`)
   - Spec usa "SECUNDÁRIO" (com acento) no campo Tipo. Hoje exibe `SECUNDARIO` sem acento.
   - Ajuste mínimo no `tipo_label` apresentado (HTML/PDF/plain), mantendo o tipo interno `SECUNDARIO` para não quebrar comparações.

**3. Texto do Status na máscara** (`mascara.ts`)
   - Hoje sem acentos por compatibilidade antiga. Spec define o texto com acentos. Vou manter o STATUS_PADRAO atual mas reintroduzir acentos do texto exibido (Status, Causa/Solução, Horário, normalização, etc.) — só rotulagem visual.

**4. Memória do projeto**
   - Salvar o documento como `mem://features/consulta-massiva/regras` e referenciar no `mem://index.md` para que futuras sessões respeitem.

### Não vou alterar
- Algoritmo Sliding Window.
- Limiares 5/15/50.
- Geo (não vira critério, segue só enriquecimento).
- Upload, dashboard, drill-down, exportações CSV/XLSX/PDF/HTML.
- Permissões, login, escalonamento.
- Tabelas do banco, RLS, edge functions.

### Detalhes técnicos
Arquivos tocados:
- `src/modules/consulta-massiva/lib/massiva-processor.ts` (ajuste no `identifyFromLotericas`).
- `src/modules/consulta-massiva/lib/mascara.ts` (label "SECUNDÁRIO" + acentos no texto exibido).
- `mem://features/consulta-massiva/regras` (novo) e `mem://index.md` (entrada nova).

Sem migrações de banco. Sem dependências novas. Sem mudanças em UI além dos rótulos da máscara.
