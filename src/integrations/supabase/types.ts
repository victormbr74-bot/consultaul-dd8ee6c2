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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value_boolean: boolean
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean
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
      lotericas: {
        Row: {
          ccto_oemp: string | null
          ccto_oi: string | null
          cidade: string | null
          cod_ul: string
          contato: string | null
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
          cod_ul: string
          contato?: string | null
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
          cod_ul?: string
          contato?: string | null
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
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          name: string
          user_code: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          name: string
          user_code?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          user_code?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
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
      can_manage_app_data: { Args: { _user_id: string }; Returns: boolean }
      can_manage_app_settings: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "operacao" | "leitura"
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
      app_role: ["admin", "user", "operacao", "leitura"],
    },
  },
} as const
