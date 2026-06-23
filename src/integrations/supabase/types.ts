export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agencias: {
        Row: {
          bairro: string
          cep: string
          cgc_unidade: string
          cidade: string
          complemento: string
          cpe1: string
          created_at: string
          degrau: string
          designacao_circuito: string
          edd_cpe2: string
          endereco: string
          faturamento: string
          id: string
          ip_lan: string
          ip_wan: string
          ip_wan_edd_cpe2: string
          logradouro: string
          nome_logico_ponto: string
          nome_ponto: string
          nome_rede: string
          numero: string
          provedor_final: string
          tecnologia: string
          tipo_atendimento: string
          tipo_ponto: string
          uf: string
          unidade: string
          updated_at: string
          velocidade: string
          velocidade_real_solicitada: string
          visao_felix: string
          visao_freiria: string
        }
        Insert: {
          bairro?: string
          cep?: string
          cgc_unidade?: string
          cidade?: string
          complemento?: string
          cpe1?: string
          created_at?: string
          degrau?: string
          designacao_circuito?: string
          edd_cpe2?: string
          endereco?: string
          faturamento?: string
          id?: string
          ip_lan?: string
          ip_wan?: string
          ip_wan_edd_cpe2?: string
          logradouro?: string
          nome_logico_ponto?: string
          nome_ponto?: string
          nome_rede?: string
          numero?: string
          provedor_final?: string
          tecnologia?: string
          tipo_atendimento?: string
          tipo_ponto?: string
          uf?: string
          unidade?: string
          updated_at?: string
          velocidade?: string
          velocidade_real_solicitada?: string
          visao_felix?: string
          visao_freiria?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cgc_unidade?: string
          cidade?: string
          complemento?: string
          cpe1?: string
          created_at?: string
          degrau?: string
          designacao_circuito?: string
          edd_cpe2?: string
          endereco?: string
          faturamento?: string
          id?: string
          ip_lan?: string
          ip_wan?: string
          ip_wan_edd_cpe2?: string
          logradouro?: string
          nome_logico_ponto?: string
          nome_ponto?: string
          nome_rede?: string
          numero?: string
          provedor_final?: string
          tecnologia?: string
          tipo_atendimento?: string
          tipo_ponto?: string
          uf?: string
          unidade?: string
          updated_at?: string
          velocidade?: string
          velocidade_real_solicitada?: string
          visao_felix?: string
          visao_freiria?: string
        }
        Relationships: []
      }
      analise_resultado_atual: {
        Row: {
          id: string
          payload: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      analises: {
        Row: {
          arquivo_1link: string | null
          arquivo_2links: string | null
          circuitos_impactados: number
          created_at: string
          executado_por: string | null
          id: string
          qtd_principal_oemp: number
          qtd_principal_vtal: number
          qtd_secundario_nacional: number
          qtd_secundario_uf: number
          total_registros: number
          ufs_impactadas: number
        }
        Insert: {
          arquivo_1link?: string | null
          arquivo_2links?: string | null
          circuitos_impactados?: number
          created_at?: string
          executado_por?: string | null
          id?: string
          qtd_principal_oemp?: number
          qtd_principal_vtal?: number
          qtd_secundario_nacional?: number
          qtd_secundario_uf?: number
          total_registros?: number
          ufs_impactadas?: number
        }
        Update: {
          arquivo_1link?: string | null
          arquivo_2links?: string | null
          circuitos_impactados?: number
          created_at?: string
          executado_por?: string | null
          id?: string
          qtd_principal_oemp?: number
          qtd_principal_vtal?: number
          qtd_secundario_nacional?: number
          qtd_secundario_uf?: number
          total_registros?: number
          ufs_impactadas?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value_boolean: boolean
          value_text: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean
          value_text?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean
          value_text?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string | null
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      base_cidades: {
        Row: {
          cidade: string
          cidade_normalizada: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          uf: string
          updated_at: string
        }
        Insert: {
          cidade: string
          cidade_normalizada: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          uf: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          cidade_normalizada?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      cod_encerramento: {
        Row: {
          codigo: string
          created_at: string
          id: string
          n1: string
          n2: string
          n3: string
          quando_utilizar: string
          updated_at: string
        }
        Insert: {
          codigo?: string
          created_at?: string
          id?: string
          n1?: string
          n2?: string
          n3?: string
          quando_utilizar?: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          n1?: string
          n2?: string
          n3?: string
          quando_utilizar?: string
          updated_at?: string
        }
        Relationships: []
      }
      controle_diario: {
        Row: {
          chamado: string | null
          chave: string | null
          cidade: string | null
          codigo_loterica: string
          created_at: string
          data_hora_inicial: string | null
          data_referencia: string
          designacao: string | null
          designacao_parceiro: string | null
          duracao_h: number | null
          empresa: string | null
          fila_jira: string | null
          grafana: string | null
          id: string
          inc_snow: string | null
          incidente_mam: string | null
          ip_loopback: string | null
          loterica: string | null
          normalizado_em: string | null
          novo_circuito: string | null
          obs: string | null
          ordem: string | null
          pendente_enriquecimento: boolean
          previsao_atendimento: string | null
          responsavel: string | null
          responsavel_backup: string | null
          responsavel_chip: string | null
          situacao: string | null
          status_jira: string | null
          status_normalizacao: string
          status_planilha: string | null
          status_zabbix: string | null
          tem_os_reparo: boolean
          tipo_link: string | null
          uf: string | null
          ultimo_comentario: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          chamado?: string | null
          chave?: string | null
          cidade?: string | null
          codigo_loterica: string
          created_at?: string
          data_hora_inicial?: string | null
          data_referencia: string
          designacao?: string | null
          designacao_parceiro?: string | null
          duracao_h?: number | null
          empresa?: string | null
          fila_jira?: string | null
          grafana?: string | null
          id?: string
          inc_snow?: string | null
          incidente_mam?: string | null
          ip_loopback?: string | null
          loterica?: string | null
          normalizado_em?: string | null
          novo_circuito?: string | null
          obs?: string | null
          ordem?: string | null
          pendente_enriquecimento?: boolean
          previsao_atendimento?: string | null
          responsavel?: string | null
          responsavel_backup?: string | null
          responsavel_chip?: string | null
          situacao?: string | null
          status_jira?: string | null
          status_normalizacao?: string
          status_planilha?: string | null
          status_zabbix?: string | null
          tem_os_reparo?: boolean
          tipo_link?: string | null
          uf?: string | null
          ultimo_comentario?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          chamado?: string | null
          chave?: string | null
          cidade?: string | null
          codigo_loterica?: string
          created_at?: string
          data_hora_inicial?: string | null
          data_referencia?: string
          designacao?: string | null
          designacao_parceiro?: string | null
          duracao_h?: number | null
          empresa?: string | null
          fila_jira?: string | null
          grafana?: string | null
          id?: string
          inc_snow?: string | null
          incidente_mam?: string | null
          ip_loopback?: string | null
          loterica?: string | null
          normalizado_em?: string | null
          novo_circuito?: string | null
          obs?: string | null
          ordem?: string | null
          pendente_enriquecimento?: boolean
          previsao_atendimento?: string | null
          responsavel?: string | null
          responsavel_backup?: string | null
          responsavel_chip?: string | null
          situacao?: string | null
          status_jira?: string | null
          status_normalizacao?: string
          status_planilha?: string | null
          status_zabbix?: string | null
          tem_os_reparo?: boolean
          tipo_link?: string | null
          uf?: string | null
          ultimo_comentario?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      escalonamentos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          n1_email: string | null
          n1_nome: string | null
          n1_telefone: string | null
          n2_email: string | null
          n2_nome: string | null
          n2_telefone: string | null
          n3_email: string | null
          n3_nome: string | null
          n3_telefone: string | null
          n4_email: string | null
          n4_nome: string | null
          n4_telefone: string | null
          observacao: string | null
          operadora: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          n1_email?: string | null
          n1_nome?: string | null
          n1_telefone?: string | null
          n2_email?: string | null
          n2_nome?: string | null
          n2_telefone?: string | null
          n3_email?: string | null
          n3_nome?: string | null
          n3_telefone?: string | null
          n4_email?: string | null
          n4_nome?: string | null
          n4_telefone?: string | null
          observacao?: string | null
          operadora: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          n1_email?: string | null
          n1_nome?: string | null
          n1_telefone?: string | null
          n2_email?: string | null
          n2_nome?: string | null
          n2_telefone?: string | null
          n3_email?: string | null
          n3_nome?: string | null
          n3_telefone?: string | null
          n4_email?: string | null
          n4_nome?: string | null
          n4_telefone?: string | null
          observacao?: string | null
          operadora?: string
          updated_at?: string
        }
        Relationships: []
      }
      falhas_gis: {
        Row: {
          categoria_gis: string | null
          categoria_gis_secundaria: string | null
          chamado: string | null
          cidade: string | null
          cod_ul: string | null
          data_hora_inicial: string | null
          designacao: string | null
          duracao_horas: number | null
          empresa: string | null
          id_alarme: string | null
          imported_at: string
          ip_loopback: string | null
          loterica: string | null
          m_duration: number | null
          n_req_caixa: string | null
          pontuacao_ul: number | null
          previsao_atendimento: string | null
          raw_data: Json | null
          record_key: string
          regional: string | null
          site_owner: string | null
          situacao: string | null
          status: string | null
          status_secundario: string | null
          tecnologia: string | null
          telefone: string | null
          tipo_link: string | null
          uf: string | null
          ultimo_comentario_em: string | null
        }
        Insert: {
          categoria_gis?: string | null
          categoria_gis_secundaria?: string | null
          chamado?: string | null
          cidade?: string | null
          cod_ul?: string | null
          data_hora_inicial?: string | null
          designacao?: string | null
          duracao_horas?: number | null
          empresa?: string | null
          id_alarme?: string | null
          imported_at?: string
          ip_loopback?: string | null
          loterica?: string | null
          m_duration?: number | null
          n_req_caixa?: string | null
          pontuacao_ul?: number | null
          previsao_atendimento?: string | null
          raw_data?: Json | null
          record_key: string
          regional?: string | null
          site_owner?: string | null
          situacao?: string | null
          status?: string | null
          status_secundario?: string | null
          tecnologia?: string | null
          telefone?: string | null
          tipo_link?: string | null
          uf?: string | null
          ultimo_comentario_em?: string | null
        }
        Update: {
          categoria_gis?: string | null
          categoria_gis_secundaria?: string | null
          chamado?: string | null
          cidade?: string | null
          cod_ul?: string | null
          data_hora_inicial?: string | null
          designacao?: string | null
          duracao_horas?: number | null
          empresa?: string | null
          id_alarme?: string | null
          imported_at?: string
          ip_loopback?: string | null
          loterica?: string | null
          m_duration?: number | null
          n_req_caixa?: string | null
          pontuacao_ul?: number | null
          previsao_atendimento?: string | null
          raw_data?: Json | null
          record_key?: string
          regional?: string | null
          site_owner?: string | null
          situacao?: string | null
          status?: string | null
          status_secundario?: string | null
          tecnologia?: string | null
          telefone?: string | null
          tipo_link?: string | null
          uf?: string | null
          ultimo_comentario_em?: string | null
        }
        Relationships: []
      }
      historico_tratativas: {
        Row: {
          campo: string
          codigo_loterica: string
          controle_id: string | null
          data_hora: string
          id: string
          recorded_by: string | null
          usuario: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          codigo_loterica: string
          controle_id?: string | null
          data_hora?: string
          id?: string
          recorded_by?: string | null
          usuario?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          codigo_loterica?: string
          controle_id?: string | null
          data_hora?: string
          id?: string
          recorded_by?: string | null
          usuario?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_tratativas_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controle_diario"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacoes: {
        Row: {
          analise_tipo: string | null
          atualizado_em: string
          codigo_loterica: string
          data_atualizacao: string | null
          evento: string | null
          fase: string | null
          id: string
          loterica: string | null
          nova_designacao: string | null
          novo_circuito: string | null
          parceira: string | null
          status_censitec: string | null
        }
        Insert: {
          analise_tipo?: string | null
          atualizado_em?: string
          codigo_loterica: string
          data_atualizacao?: string | null
          evento?: string | null
          fase?: string | null
          id?: string
          loterica?: string | null
          nova_designacao?: string | null
          novo_circuito?: string | null
          parceira?: string | null
          status_censitec?: string | null
        }
        Update: {
          analise_tipo?: string | null
          atualizado_em?: string
          codigo_loterica?: string
          data_atualizacao?: string | null
          evento?: string | null
          fase?: string | null
          id?: string
          loterica?: string | null
          nova_designacao?: string | null
          novo_circuito?: string | null
          parceira?: string | null
          status_censitec?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          arquivo: string
          data_hora: string
          id: string
          registros: number
          tipo: string
          usuario: string
        }
        Insert: {
          arquivo?: string
          data_hora?: string
          id?: string
          registros?: number
          tipo?: string
          usuario?: string
        }
        Update: {
          arquivo?: string
          data_hora?: string
          id?: string
          registros?: number
          tipo?: string
          usuario?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo: string
          data_importacao: string
          id: string
          registros: number
          status: string
          tipo: Database["public"]["Enums"]["tipo_importacao"]
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          arquivo: string
          data_importacao?: string
          id?: string
          registros?: number
          status?: string
          tipo: Database["public"]["Enums"]["tipo_importacao"]
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          arquivo?: string
          data_importacao?: string
          id?: string
          registros?: number
          status?: string
          tipo?: Database["public"]["Enums"]["tipo_importacao"]
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      incidentes: {
        Row: {
          agencia_nome: string
          causa: string
          causa_raiz: string
          chamado: string
          circuito: string
          contrato: string
          created_at: string
          data_hora_abertura: string
          data_hora_atualizacao: string
          descricao_falha: string
          descricao_inicial: string
          gitec: string
          id: string
          isolado: string
          massiva: boolean
          normalizacao_data_hora: string | null
          normalizacao_data_hora_fechamento: string | null
          oemp: string
          periodo_ultima_atualizacao: string
          ponto_codigo: string
          protocolo_portal: string
          reclamacao: string
          rede: string
          req: string
          responsavel_portal: string
          sla: string
          status: string
          tempo_total: string
          tipo_circuito: string
          tipo_ponto: string
          tipo_solicitacao: string
          uf: string
          ultimo_comentario: string
          updated_at: string
          vulto: string
        }
        Insert: {
          agencia_nome?: string
          causa?: string
          causa_raiz?: string
          chamado?: string
          circuito?: string
          contrato?: string
          created_at?: string
          data_hora_abertura?: string
          data_hora_atualizacao?: string
          descricao_falha?: string
          descricao_inicial?: string
          gitec?: string
          id?: string
          isolado?: string
          massiva?: boolean
          normalizacao_data_hora?: string | null
          normalizacao_data_hora_fechamento?: string | null
          oemp?: string
          periodo_ultima_atualizacao?: string
          ponto_codigo?: string
          protocolo_portal?: string
          reclamacao?: string
          rede?: string
          req?: string
          responsavel_portal?: string
          sla?: string
          status?: string
          tempo_total?: string
          tipo_circuito?: string
          tipo_ponto?: string
          tipo_solicitacao?: string
          uf?: string
          ultimo_comentario?: string
          updated_at?: string
          vulto?: string
        }
        Update: {
          agencia_nome?: string
          causa?: string
          causa_raiz?: string
          chamado?: string
          circuito?: string
          contrato?: string
          created_at?: string
          data_hora_abertura?: string
          data_hora_atualizacao?: string
          descricao_falha?: string
          descricao_inicial?: string
          gitec?: string
          id?: string
          isolado?: string
          massiva?: boolean
          normalizacao_data_hora?: string | null
          normalizacao_data_hora_fechamento?: string | null
          oemp?: string
          periodo_ultima_atualizacao?: string
          ponto_codigo?: string
          protocolo_portal?: string
          reclamacao?: string
          rede?: string
          req?: string
          responsavel_portal?: string
          sla?: string
          status?: string
          tempo_total?: string
          tipo_circuito?: string
          tipo_ponto?: string
          tipo_solicitacao?: string
          uf?: string
          ultimo_comentario?: string
          updated_at?: string
          vulto?: string
        }
        Relationships: []
      }
      jira_abertos: {
        Row: {
          categoria_sintoma: string | null
          chave: string
          cod_ul: string | null
          criado: string | null
          data_agendamento: string | null
          data_hora_normalizacao: string | null
          data_proxima_atualizacao: string | null
          descricao: string | null
          imported_at: string
          n_inc_snow: string | null
          n_incidente_mam: string | null
          n_req_caixa: string | null
          raw_data: Json | null
          relator: string | null
          responsavel: string | null
          resumo: string | null
          site_owner: string | null
          status: string | null
          tipo_falha: string | null
        }
        Insert: {
          categoria_sintoma?: string | null
          chave: string
          cod_ul?: string | null
          criado?: string | null
          data_agendamento?: string | null
          data_hora_normalizacao?: string | null
          data_proxima_atualizacao?: string | null
          descricao?: string | null
          imported_at?: string
          n_inc_snow?: string | null
          n_incidente_mam?: string | null
          n_req_caixa?: string | null
          raw_data?: Json | null
          relator?: string | null
          responsavel?: string | null
          resumo?: string | null
          site_owner?: string | null
          status?: string | null
          tipo_falha?: string | null
        }
        Update: {
          categoria_sintoma?: string | null
          chave?: string
          cod_ul?: string | null
          criado?: string | null
          data_agendamento?: string | null
          data_hora_normalizacao?: string | null
          data_proxima_atualizacao?: string | null
          descricao?: string | null
          imported_at?: string
          n_inc_snow?: string | null
          n_incidente_mam?: string | null
          n_req_caixa?: string | null
          raw_data?: Json | null
          relator?: string | null
          responsavel?: string | null
          resumo?: string | null
          site_owner?: string | null
          status?: string | null
          tipo_falha?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      loterica_change_requests: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          cod_ul: string
          id: string
          proposed_at: string
          proposed_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          cod_ul: string
          id?: string
          proposed_at?: string
          proposed_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          cod_ul?: string
          id?: string
          proposed_at?: string
          proposed_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loterica_change_requests_cod_ul_fkey"
            columns: ["cod_ul"]
            isOneToOne: false
            referencedRelation: "lotericas"
            referencedColumns: ["cod_ul"]
          },
        ]
      }
      loterica_history: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_at: string
          changed_by: string | null
          cod_ul: string
          id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          cod_ul: string
          id?: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          cod_ul?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loterica_history_cod_ul_fkey"
            columns: ["cod_ul"]
            isOneToOne: false
            referencedRelation: "lotericas"
            referencedColumns: ["cod_ul"]
          },
        ]
      }
      loterica_notices: {
        Row: {
          cod_ul: string
          created_at: string
          created_by: string
          id: string
          observacao: string
        }
        Insert: {
          cod_ul: string
          created_at?: string
          created_by: string
          id?: string
          observacao: string
        }
        Update: {
          cod_ul?: string
          created_at?: string
          created_by?: string
          id?: string
          observacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "loterica_notices_cod_ul_fkey"
            columns: ["cod_ul"]
            isOneToOne: false
            referencedRelation: "lotericas"
            referencedColumns: ["cod_ul"]
          },
        ]
      }
      loterica_router_configs: {
        Row: {
          cod_ul: string
          config_type: string
          created_at: string
          created_by: string
          id: string
          observacao: string
          reminder_acknowledged_at: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cod_ul: string
          config_type: string
          created_at?: string
          created_by: string
          id?: string
          observacao: string
          reminder_acknowledged_at?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          cod_ul?: string
          config_type?: string
          created_at?: string
          created_by?: string
          id?: string
          observacao?: string
          reminder_acknowledged_at?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      lotericas: {
        Row: {
          ccto_oemp: string | null
          ccto_oi: string | null
          cidade: string | null
          circuito_elsys: string | null
          cod_ul: string
          contato: string | null
          cpe_meraki: string | null
          designacao_nova: string | null
          endereco: string | null
          ip_nat: string | null
          ip_wan: string | null
          loopback_lan: string | null
          loopback_wan: string | null
          nome_loterica: string | null
          operadora: string | null
          raw_data: Json | null
          status: string | null
          uf: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ccto_oemp?: string | null
          ccto_oi?: string | null
          cidade?: string | null
          circuito_elsys?: string | null
          cod_ul: string
          contato?: string | null
          cpe_meraki?: string | null
          designacao_nova?: string | null
          endereco?: string | null
          ip_nat?: string | null
          ip_wan?: string | null
          loopback_lan?: string | null
          loopback_wan?: string | null
          nome_loterica?: string | null
          operadora?: string | null
          raw_data?: Json | null
          status?: string | null
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ccto_oemp?: string | null
          ccto_oi?: string | null
          cidade?: string | null
          circuito_elsys?: string | null
          cod_ul?: string
          contato?: string | null
          cpe_meraki?: string | null
          designacao_nova?: string | null
          endereco?: string | null
          ip_nat?: string | null
          ip_wan?: string | null
          loopback_lan?: string | null
          loopback_wan?: string | null
          nome_loterica?: string | null
          operadora?: string | null
          raw_data?: Json | null
          status?: string | null
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      macro_base_alarmes: {
        Row: {
          ccto_oemp: string | null
          ccto_oi: string | null
          cidade: string | null
          cod_ul: string
          contato: string | null
          designacao_nova: string | null
          endereco: string | null
          imported_at: string
          ip_nat: string | null
          ip_wan: string | null
          loopback_lan: string | null
          loopback_wan: string | null
          nome_loterica: string | null
          operadora: string | null
          raw_data: Json | null
          status: string | null
          uf: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ccto_oemp?: string | null
          ccto_oi?: string | null
          cidade?: string | null
          cod_ul: string
          contato?: string | null
          designacao_nova?: string | null
          endereco?: string | null
          imported_at?: string
          ip_nat?: string | null
          ip_wan?: string | null
          loopback_lan?: string | null
          loopback_wan?: string | null
          nome_loterica?: string | null
          operadora?: string | null
          raw_data?: Json | null
          status?: string | null
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ccto_oemp?: string | null
          ccto_oi?: string | null
          cidade?: string | null
          cod_ul?: string
          contato?: string | null
          designacao_nova?: string | null
          endereco?: string | null
          imported_at?: string
          ip_nat?: string | null
          ip_wan?: string | null
          loopback_lan?: string | null
          loopback_wan?: string | null
          nome_loterica?: string | null
          operadora?: string | null
          raw_data?: Json | null
          status?: string | null
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      massiva_circuitos: {
        Row: {
          alarme_id: string | null
          cidade: string | null
          codigo_loterica: string | null
          data_hora: string | null
          designacao: string | null
          empresa: string | null
          id: string
          ip_loopback: string | null
          loterica: string | null
          massiva_id: string
          mensagem: string | null
          operadora: string | null
          regional: string | null
          status: string | null
          tecnologia: string | null
          telefone: string | null
          tipo_empresa: string | null
          tipo_link: string | null
          uf: string | null
        }
        Insert: {
          alarme_id?: string | null
          cidade?: string | null
          codigo_loterica?: string | null
          data_hora?: string | null
          designacao?: string | null
          empresa?: string | null
          id?: string
          ip_loopback?: string | null
          loterica?: string | null
          massiva_id: string
          mensagem?: string | null
          operadora?: string | null
          regional?: string | null
          status?: string | null
          tecnologia?: string | null
          telefone?: string | null
          tipo_empresa?: string | null
          tipo_link?: string | null
          uf?: string | null
        }
        Update: {
          alarme_id?: string | null
          cidade?: string | null
          codigo_loterica?: string | null
          data_hora?: string | null
          designacao?: string | null
          empresa?: string | null
          id?: string
          ip_loopback?: string | null
          loterica?: string | null
          massiva_id?: string
          mensagem?: string | null
          operadora?: string | null
          regional?: string | null
          status?: string | null
          tecnologia?: string | null
          telefone?: string | null
          tipo_empresa?: string | null
          tipo_link?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "massiva_circuitos_massiva_id_fkey"
            columns: ["massiva_id"]
            isOneToOne: false
            referencedRelation: "massivas"
            referencedColumns: ["id"]
          },
        ]
      }
      massivas: {
        Row: {
          analise_id: string | null
          atualizacao: string | null
          chamado: string | null
          cidade_epicentro: string | null
          circuito_pai: string | null
          consorcio_ul: string
          created_at: string
          data_hora_abertura: string | null
          data_hora_normalizacao: string | null
          id: string
          id_massiva: string
          inc: string | null
          mascara_texto: string | null
          operadora: string
          primeiro_alarme: string | null
          qtd_circuitos: number
          qtd_lotericas_isoladas: number
          raio_maximo_km: number | null
          sinalizacao_60km: string | null
          status: string
          tipo_link: string | null
          tipo_massiva: Database["public"]["Enums"]["tipo_massiva_enum"]
          uf: string
          uf_epicentro: string | null
          ultimo_alarme: string | null
        }
        Insert: {
          analise_id?: string | null
          atualizacao?: string | null
          chamado?: string | null
          cidade_epicentro?: string | null
          circuito_pai?: string | null
          consorcio_ul?: string
          created_at?: string
          data_hora_abertura?: string | null
          data_hora_normalizacao?: string | null
          id?: string
          id_massiva: string
          inc?: string | null
          mascara_texto?: string | null
          operadora?: string
          primeiro_alarme?: string | null
          qtd_circuitos: number
          qtd_lotericas_isoladas?: number
          raio_maximo_km?: number | null
          sinalizacao_60km?: string | null
          status?: string
          tipo_link?: string | null
          tipo_massiva: Database["public"]["Enums"]["tipo_massiva_enum"]
          uf?: string
          uf_epicentro?: string | null
          ultimo_alarme?: string | null
        }
        Update: {
          analise_id?: string | null
          atualizacao?: string | null
          chamado?: string | null
          cidade_epicentro?: string | null
          circuito_pai?: string | null
          consorcio_ul?: string
          created_at?: string
          data_hora_abertura?: string | null
          data_hora_normalizacao?: string | null
          id?: string
          id_massiva?: string
          inc?: string | null
          mascara_texto?: string | null
          operadora?: string
          primeiro_alarme?: string | null
          qtd_circuitos?: number
          qtd_lotericas_isoladas?: number
          raio_maximo_km?: number | null
          sinalizacao_60km?: string | null
          status?: string
          tipo_link?: string | null
          tipo_massiva?: Database["public"]["Enums"]["tipo_massiva_enum"]
          uf?: string
          uf_epicentro?: string | null
          ultimo_alarme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "massivas_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["id"]
          },
        ]
      }
      meus_casos: {
        Row: {
          criado_em: string
          id: string
          incidente_chamado: string
          notas: string[]
          status_caso: string
          updated_at: string
          usuario_nome: string
        }
        Insert: {
          criado_em?: string
          id?: string
          incidente_chamado?: string
          notas?: string[]
          status_caso?: string
          updated_at?: string
          usuario_nome?: string
        }
        Update: {
          criado_em?: string
          id?: string
          incidente_chamado?: string
          notas?: string[]
          status_caso?: string
          updated_at?: string
          usuario_nome?: string
        }
        Relationships: []
      }
      operadoras: {
        Row: {
          ativo: boolean
          codigo_loterica: string
          created_at: string
          designacao: string
          id: string
          ip_loopback: string
          ip_loopback_secundario: string
          operadora: string
          operadora_4g: string
          tipo_empresa: Database["public"]["Enums"]["tipo_empresa_enum"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_loterica?: string
          created_at?: string
          designacao?: string
          id?: string
          ip_loopback?: string
          ip_loopback_secundario?: string
          operadora: string
          operadora_4g?: string
          tipo_empresa: Database["public"]["Enums"]["tipo_empresa_enum"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_loterica?: string
          created_at?: string
          designacao?: string
          id?: string
          ip_loopback?: string
          ip_loopback_secundario?: string
          operadora?: string
          operadora_4g?: string
          tipo_empresa?: Database["public"]["Enums"]["tipo_empresa_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      parceiras: {
        Row: {
          contato: string
          created_at: string
          email: string
          id: string
          nome_operadora: string
          observacoes: string
          telefone: string
          updated_at: string
        }
        Insert: {
          contato?: string
          created_at?: string
          email?: string
          id?: string
          nome_operadora?: string
          observacoes?: string
          telefone?: string
          updated_at?: string
        }
        Update: {
          contato?: string
          created_at?: string
          email?: string
          id?: string
          nome_operadora?: string
          observacoes?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      ping_automation_results: {
        Row: {
          cod_ul: string | null
          command_text: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          input_term: string
          ips: Json
          packet_count: number | null
          page_type: string
          raw_log: string
          securecrt_session_name: string | null
          source: string
          started_at: string | null
          status: string
          summary_json: Json
          target: string | null
        }
        Insert: {
          cod_ul?: string | null
          command_text?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input_term: string
          ips?: Json
          packet_count?: number | null
          page_type: string
          raw_log?: string
          securecrt_session_name?: string | null
          source?: string
          started_at?: string | null
          status?: string
          summary_json?: Json
          target?: string | null
        }
        Update: {
          cod_ul?: string | null
          command_text?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input_term?: string
          ips?: Json
          packet_count?: number | null
          page_type?: string
          raw_log?: string
          securecrt_session_name?: string | null
          source?: string
          started_at?: string | null
          status?: string
          summary_json?: Json
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ping_automation_results_cod_ul_fkey"
            columns: ["cod_ul"]
            isOneToOne: false
            referencedRelation: "lotericas"
            referencedColumns: ["cod_ul"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          ativo: boolean
          created_at: string
          criado_em: string
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          name: string
          nome: string | null
          updated_at: string
          user_code: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          active?: boolean
          ativo?: boolean
          created_at?: string
          criado_em?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          name: string
          nome?: string | null
          updated_at?: string
          user_code?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean
          ativo?: boolean
          created_at?: string
          criado_em?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          nome?: string | null
          updated_at?: string
          user_code?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      router_script_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          model: string
          name: string
          notes: string | null
          operadora_4g: string
          owner: string
          router_role: string
          script_variant: string
          switch_topology: string
          technology: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          model: string
          name: string
          notes?: string | null
          operadora_4g?: string
          owner: string
          router_role: string
          script_variant: string
          switch_topology: string
          technology: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          model?: string
          name?: string
          notes?: string | null
          operadora_4g?: string
          owner?: string
          router_role?: string
          script_variant?: string
          switch_topology?: string
          technology?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      staging_bases: {
        Row: {
          criado_em: string
          id: string
          importacao_id: string | null
          linhas: Json
          tipo: Database["public"]["Enums"]["tipo_importacao"]
        }
        Insert: {
          criado_em?: string
          id?: string
          importacao_id?: string | null
          linhas?: Json
          tipo: Database["public"]["Enums"]["tipo_importacao"]
        }
        Update: {
          criado_em?: string
          id?: string
          importacao_id?: string | null
          linhas?: Json
          tipo?: Database["public"]["Enums"]["tipo_importacao"]
        }
        Relationships: [
          {
            foreignKeyName: "staging_bases_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      topologia: {
        Row: {
          comandos: string
          concentrador: string
          created_at: string
          descricao: string
          id: string
          ip: string
          lan: string
          observacoes: string
          uf_regiao: string
          updated_at: string
          vlan: string
          wan1: string
          wan2: string
        }
        Insert: {
          comandos?: string
          concentrador?: string
          created_at?: string
          descricao?: string
          id?: string
          ip?: string
          lan?: string
          observacoes?: string
          uf_regiao?: string
          updated_at?: string
          vlan?: string
          wan1?: string
          wan2?: string
        }
        Update: {
          comandos?: string
          concentrador?: string
          created_at?: string
          descricao?: string
          id?: string
          ip?: string
          lan?: string
          observacoes?: string
          uf_regiao?: string
          updated_at?: string
          vlan?: string
          wan1?: string
          wan2?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_principal_updates: { Args: { payload: Json }; Returns: number }
      can_manage_app_data: { Args: { _user_id: string }; Returns: boolean }
      can_manage_app_settings: { Args: never; Returns: boolean }
      can_write: { Args: { _user_id: string }; Returns: boolean }
      compat_role_text: { Args: { _user_id: string }; Returns: string }
      current_user_is_admin_master: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      normalize_mac_text: { Args: { value: string }; Returns: string }
      search_lotericas_by_mac: {
        Args: { page_offset?: number; page_size?: number; search_mac: string }
        Returns: {
          ccto_oemp: string
          ccto_oi: string
          cidade: string
          cod_ul: string
          designacao_nova: string
          matched_field: string
          matched_value: string
          nome_loterica: string
          operadora: string
          raw_data: Json
          status: string
          total_count: number
          uf: string
        }[]
      }
      set_user_app_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "operacao"
        | "leitura"
        | "ADMIN"
        | "OPERADOR"
        | "administrador"
        | "administrador_master"
        | "consulta"
      tipo_empresa_enum: "VTAL" | "OEMP"
      tipo_importacao:
        | "gis1"
        | "gis2"
        | "controle_d1"
        | "jira"
        | "grafana"
        | "planta"
        | "os_reparo"
      tipo_massiva_enum:
        | "PRINCIPAL_VTAL"
        | "PRINCIPAL_OEMP"
        | "SECUNDARIO_UF"
        | "SECUNDARIO_NACIONAL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "user",
        "operacao",
        "leitura",
        "ADMIN",
        "OPERADOR",
        "administrador",
        "administrador_master",
        "consulta",
      ],
      tipo_empresa_enum: ["VTAL", "OEMP"],
      tipo_importacao: [
        "gis1",
        "gis2",
        "controle_d1",
        "jira",
        "grafana",
        "planta",
        "os_reparo",
      ],
      tipo_massiva_enum: [
        "PRINCIPAL_VTAL",
        "PRINCIPAL_OEMP",
        "SECUNDARIO_UF",
        "SECUNDARIO_NACIONAL",
      ],
    },
  },
} as const
