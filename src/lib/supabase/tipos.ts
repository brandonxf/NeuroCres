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
