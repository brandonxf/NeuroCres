// Generado con la herramienta de tipos de Supabase (proyecto neurocres-dev).
// Regenerar tras cada migración. No editar a mano.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string;
          actor_id: string | null;
          created_at: string;
          entidad: string;
          entidad_id: string | null;
          id: string;
          ip: unknown;
          metadata: Json;
          persona_id: string | null;
          user_agent: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      bloqueos: {
        Row: {
          created_at: string;
          fin: string;
          id: string;
          inicio: string;
          motivo: string | null;
          profesional_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          fin: string;
          id?: string;
          inicio: string;
          motivo?: string | null;
          profesional_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          fin?: string;
          id?: string;
          inicio?: string;
          motivo?: string | null;
          profesional_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bloqueos_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      citas: {
        Row: {
          anticipo_cop: number;
          bloqueo_hasta: string;
          cancelada_at: string | null;
          cancelada_por: string | null;
          created_at: string;
          creada_por: string | null;
          estado: string;
          expira_cupo_at: string | null;
          fin: string;
          id: string;
          inicio: string;
          modalidad: string;
          motivo_cancelacion: string | null;
          persona_id: string;
          politica_aceptada_at: string | null;
          politica_aceptada_id: string | null;
          precio_cop: number;
          proceso_id: string | null;
          profesional_id: string;
          reprogramada_de: string | null;
          saldo_cop: number;
          servicio_id: string;
          updated_at: string;
        };
        Insert: {
          anticipo_cop: number;
          bloqueo_hasta: string;
          cancelada_at?: string | null;
          cancelada_por?: string | null;
          created_at?: string;
          creada_por?: string | null;
          estado?: string;
          expira_cupo_at?: string | null;
          fin: string;
          id?: string;
          inicio: string;
          modalidad: string;
          motivo_cancelacion?: string | null;
          persona_id: string;
          politica_aceptada_at?: string | null;
          politica_aceptada_id?: string | null;
          precio_cop: number;
          proceso_id?: string | null;
          profesional_id: string;
          reprogramada_de?: string | null;
          saldo_cop: number;
          servicio_id: string;
          updated_at?: string;
        };
        Update: {
          anticipo_cop?: number;
          bloqueo_hasta?: string;
          cancelada_at?: string | null;
          cancelada_por?: string | null;
          created_at?: string;
          creada_por?: string | null;
          estado?: string;
          expira_cupo_at?: string | null;
          fin?: string;
          id?: string;
          inicio?: string;
          modalidad?: string;
          motivo_cancelacion?: string | null;
          persona_id?: string;
          politica_aceptada_at?: string | null;
          politica_aceptada_id?: string | null;
          precio_cop?: number;
          proceso_id?: string | null;
          profesional_id?: string;
          reprogramada_de?: string | null;
          saldo_cop?: number;
          servicio_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "citas_cancelada_por_fkey";
            columns: ["cancelada_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_creada_por_fkey";
            columns: ["creada_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_reprogramada_de_fkey";
            columns: ["reprogramada_de"];
            isOneToOne: false;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_servicio_id_fkey";
            columns: ["servicio_id"];
            isOneToOne: false;
            referencedRelation: "servicios";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracion: {
        Row: {
          clave: string;
          created_at: string;
          descripcion: string | null;
          updated_at: string;
          valor: Json;
        };
        Insert: {
          clave: string;
          created_at?: string;
          descripcion?: string | null;
          updated_at?: string;
          valor: Json;
        };
        Update: {
          clave?: string;
          created_at?: string;
          descripcion?: string | null;
          updated_at?: string;
          valor?: Json;
        };
        Relationships: [];
      };
      plantillas_consentimiento: {
        Row: {
          activa: boolean;
          contenido: string;
          created_at: string;
          id: string;
          tipo: string;
          titulo: string;
          version: number;
          vigente_desde: string;
        };
        Insert: {
          activa?: boolean;
          contenido: string;
          created_at?: string;
          id?: string;
          tipo: string;
          titulo: string;
          version: number;
          vigente_desde?: string;
        };
        Update: {
          activa?: boolean;
          contenido?: string;
          created_at?: string;
          id?: string;
          tipo?: string;
          titulo?: string;
          version?: number;
          vigente_desde?: string;
        };
        Relationships: [];
      };
      profesionales: {
        Row: {
          activo: boolean;
          created_at: string;
          enlace_videollamada: string | null;
          id: string;
          nombre_publico: string;
          registro_profesional: string | null;
          updated_at: string;
          usuario_id: string;
          zona_horaria: string;
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          enlace_videollamada?: string | null;
          id?: string;
          nombre_publico: string;
          registro_profesional?: string | null;
          updated_at?: string;
          usuario_id: string;
          zona_horaria?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          enlace_videollamada?: string | null;
          id?: string;
          nombre_publico?: string;
          registro_profesional?: string | null;
          updated_at?: string;
          usuario_id?: string;
          zona_horaria?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profesionales_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: true;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      consentimientos_firmados: {
        Row: {
          asentimiento_menor: boolean;
          calidad: string;
          constancia_path: string | null;
          firma_trazo_path: string | null;
          firmado_at: string;
          firmante_documento: string;
          firmante_nombre: string;
          firmante_usuario_id: string;
          hash_contenido: string;
          id: string;
          ip: unknown;
          persona_id: string;
          plantilla_id: string;
          user_agent: string | null;
        };
        Insert: {
          asentimiento_menor?: boolean;
          calidad: string;
          constancia_path?: string | null;
          firma_trazo_path?: string | null;
          firmado_at?: string;
          firmante_documento: string;
          firmante_nombre: string;
          firmante_usuario_id: string;
          hash_contenido: string;
          id?: string;
          ip?: unknown;
          persona_id: string;
          plantilla_id: string;
          user_agent?: string | null;
        };
        Update: {
          asentimiento_menor?: boolean;
          calidad?: string;
          constancia_path?: string | null;
          firma_trazo_path?: string | null;
          firmado_at?: string;
          firmante_documento?: string;
          firmante_nombre?: string;
          firmante_usuario_id?: string;
          hash_contenido?: string;
          id?: string;
          ip?: unknown;
          persona_id?: string;
          plantilla_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consentimientos_firmados_firmante_usuario_id_fkey";
            columns: ["firmante_usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consentimientos_firmados_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consentimientos_firmados_plantilla_id_fkey";
            columns: ["plantilla_id"];
            isOneToOne: false;
            referencedRelation: "plantillas_consentimiento";
            referencedColumns: ["id"];
          },
        ];
      };
      disponibilidad_semanal: {
        Row: {
          created_at: string;
          dia_semana: number;
          hora_fin: string;
          hora_inicio: string;
          id: string;
          modalidades: string[];
          profesional_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dia_semana: number;
          hora_fin: string;
          hora_inicio: string;
          id?: string;
          modalidades?: string[];
          profesional_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dia_semana?: number;
          hora_fin?: string;
          hora_inicio?: string;
          id?: string;
          modalidades?: string[];
          profesional_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disponibilidad_semanal_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      personas: {
        Row: {
          apellidos: string;
          correo: string | null;
          created_at: string;
          datos_escolares: Json | null;
          deleted_at: string | null;
          fecha_nacimiento: string;
          id: string;
          nombres: string;
          numero_documento: string;
          telefono: string | null;
          tipo_documento: string;
          updated_at: string;
          usuario_id: string | null;
        };
        Insert: {
          apellidos: string;
          correo?: string | null;
          created_at?: string;
          datos_escolares?: Json | null;
          deleted_at?: string | null;
          fecha_nacimiento: string;
          id?: string;
          nombres: string;
          numero_documento: string;
          telefono?: string | null;
          tipo_documento: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Update: {
          apellidos?: string;
          correo?: string | null;
          created_at?: string;
          datos_escolares?: Json | null;
          deleted_at?: string | null;
          fecha_nacimiento?: string;
          id?: string;
          nombres?: string;
          numero_documento?: string;
          telefono?: string | null;
          tipo_documento?: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "personas_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      responsables_legales: {
        Row: {
          created_at: string;
          es_principal: boolean;
          parentesco: string;
          persona_id: string;
          responsable_usuario_id: string;
          soporte_path: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          es_principal?: boolean;
          parentesco: string;
          persona_id: string;
          responsable_usuario_id: string;
          soporte_path?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          es_principal?: boolean;
          parentesco?: string;
          persona_id?: string;
          responsable_usuario_id?: string;
          soporte_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "responsables_legales_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "responsables_legales_responsable_usuario_id_fkey";
            columns: ["responsable_usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      servicios: {
        Row: {
          activo: boolean;
          agendable_en_linea: boolean;
          anticipo_pct: number;
          created_at: string;
          descripcion: string | null;
          duracion_min: number | null;
          id: string;
          modalidades: string[];
          nombre: string;
          orden: number;
          poblacion: string | null;
          precio_cop: number;
          requiere_anticipo: boolean;
          requiere_consentimiento: boolean;
          requiere_formulario: boolean;
          requiere_presencial: boolean;
          slug: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          agendable_en_linea?: boolean;
          anticipo_pct?: number;
          created_at?: string;
          descripcion?: string | null;
          duracion_min?: number | null;
          id?: string;
          modalidades?: string[];
          nombre: string;
          orden?: number;
          poblacion?: string | null;
          precio_cop: number;
          requiere_anticipo?: boolean;
          requiere_consentimiento?: boolean;
          requiere_formulario?: boolean;
          requiere_presencial?: boolean;
          slug: string;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          agendable_en_linea?: boolean;
          anticipo_pct?: number;
          created_at?: string;
          descripcion?: string | null;
          duracion_min?: number | null;
          id?: string;
          modalidades?: string[];
          nombre?: string;
          orden?: number;
          poblacion?: string | null;
          precio_cop?: number;
          requiere_anticipo?: boolean;
          requiere_consentimiento?: boolean;
          requiere_formulario?: boolean;
          requiere_presencial?: boolean;
          slug?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          apellidos: string | null;
          correo: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          nombres: string | null;
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          apellidos?: string | null;
          correo: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          nombres?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          apellidos?: string | null;
          correo?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          nombres?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuarios_roles: {
        Row: {
          created_at: string;
          rol: string;
          updated_at: string;
          usuario_id: string;
        };
        Insert: {
          created_at?: string;
          rol: string;
          updated_at?: string;
          usuario_id: string;
        };
        Update: {
          created_at?: string;
          rol?: string;
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_roles_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      crear_persona_a_cargo: {
        Args: {
          p_apellidos: string;
          p_correo?: string;
          p_fecha_nacimiento: string;
          p_nombres: string;
          p_numero_documento: string;
          p_parentesco: string;
          p_telefono?: string;
          p_tipo_documento: string;
        };
        Returns: string;
      };
      consentimientos_completos: {
        Args: { p_persona_id: string };
        Returns: boolean;
      };
      consentimientos_pendientes: {
        Args: { p_persona_id: string };
        Returns: {
          plantilla_id: string;
          tipo: string;
          titulo: string;
        }[];
      };
      edad_en_anios: { Args: { p_fecha_nacimiento: string }; Returns: number };
      firmar_consentimiento: {
        Args: {
          p_asentimiento_menor?: boolean;
          p_firma_trazo_path?: string;
          p_firmante_documento: string;
          p_firmante_nombre: string;
          p_ip?: string;
          p_persona_id: string;
          p_plantilla_id: string;
          p_user_agent?: string;
        };
        Returns: string;
      };
      plantilla_firmada_por_mi: {
        Args: { p_plantilla_id: string };
        Returns: boolean;
      };
      publicar_plantilla: {
        Args: { p_contenido: string; p_tipo: string; p_titulo: string };
        Returns: string;
      };
      registrar_constancia: {
        Args: { p_consentimiento_id: string; p_ruta: string };
        Returns: undefined;
      };
      tipos_consentimiento_requeridos: {
        Args: { p_persona_id: string };
        Returns: string[];
      };
      cambiar_estado_cita: {
        Args: { p_cita_id: string; p_motivo?: string; p_nuevo_estado: string };
        Returns: undefined;
      };
      es_dueno_de_persona: { Args: { p_persona_id: string }; Returns: boolean };
      registrar_evento: {
        Args: {
          p_accion: string;
          p_entidad: string;
          p_entidad_id: string;
          p_ip?: string;
          p_metadata?: Json;
          p_persona_id: string;
          p_user_agent?: string;
        };
        Returns: undefined;
      };
      es_profesional: { Args: { p_profesional_id: string }; Returns: boolean };
      ocupacion_profesional: {
        Args: { p_desde: string; p_hasta: string; p_profesional_id: string };
        Returns: {
          fin: string;
          inicio: string;
        }[];
      };
      obtener_enlace_videollamada: {
        Args: { p_profesional_id: string };
        Returns: string;
      };
      tiene_rol: { Args: { p_rol: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
