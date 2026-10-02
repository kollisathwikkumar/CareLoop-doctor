
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"patient_id": string | null,"summary": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"patient_id"?: string | null,"summary": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"patient_id"?: string | null,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_responses": {
                  Row: {
                    "appointment_id": string,"created_at": string,"id": string,"patient_id": string,"requested_scheduled_at": string | null,"responded_by": string,"response": string
                  }
                  Insert: {
                    "appointment_id": string,"created_at"?: string,"id"?: string,"patient_id": string,"requested_scheduled_at"?: string | null,"responded_by": string,"response": string
                  }
                  Update: {
                    "appointment_id"?: string,"created_at"?: string,"id"?: string,"patient_id"?: string,"requested_scheduled_at"?: string | null,"responded_by"?: string,"response"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_responses_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_responses_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"doctor_id": string | null,"id": string,"notes": string | null,"patient_id": string,"purpose": string,"scheduled_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"doctor_id"?: string | null,"id"?: string,"notes"?: string | null,"patient_id": string,"purpose": string,"scheduled_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"doctor_id"?: string | null,"id"?: string,"notes"?: string | null,"patient_id"?: string,"purpose"?: string,"scheduled_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_doctor_id_fkey"
      columns: ["doctor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"metadata": NonNullable<Json>,"organisation_id": string | null,"patient_id": string | null
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"metadata"?: NonNullable<Json>,"organisation_id"?: string | null,"patient_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"organisation_id"?: string | null,"patient_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"care_journey_events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_type": string,"id": string,"metadata": NonNullable<Json>,"occurred_at": string,"patient_id": string,"patient_visible": boolean,"summary": string | null,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_type": string,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"patient_id": string,"patient_visible"?: boolean,"summary"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_type"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"patient_id"?: string,"patient_visible"?: boolean,"summary"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_journey_events_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"care_plans": {
                  Row: {
                    "actions": string,"created_at": string,"created_by": string | null,"goal": string,"id": string,"patient_id": string,"responsible_profile_id": string | null,"review_date": string,"status": Database["public"]['Enums']["care_plan_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "actions": string,"created_at"?: string,"created_by"?: string | null,"goal": string,"id"?: string,"patient_id": string,"responsible_profile_id"?: string | null,"review_date": string,"status"?: Database["public"]['Enums']["care_plan_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "actions"?: string,"created_at"?: string,"created_by"?: string | null,"goal"?: string,"id"?: string,"patient_id"?: string,"responsible_profile_id"?: string | null,"review_date"?: string,"status"?: Database["public"]['Enums']["care_plan_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_plans_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_plans_responsible_profile_id_fkey"
      columns: ["responsible_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"care_team_memberships": {
                  Row: {
                    "active": boolean,"care_team_id": string,"created_at": string,"profile_id": string,"role": Database["public"]['Enums']["profile_role"]
                  }
                  Insert: {
                    "active"?: boolean,"care_team_id": string,"created_at"?: string,"profile_id": string,"role": Database["public"]['Enums']["profile_role"]
                  }
                  Update: {
                    "active"?: boolean,"care_team_id"?: string,"created_at"?: string,"profile_id"?: string,"role"?: Database["public"]['Enums']["profile_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_team_memberships_care_team_id_fkey"
      columns: ["care_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_team_memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"care_team_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"patient_id": string,"read_at": string | null,"sender_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"patient_id": string,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"patient_id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_team_messages_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"care_teams": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"organisation_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"organisation_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"organisation_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_teams_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_consents": {
                  Row: {
                    "care_team_id": string,"consent_version": string,"consented_at": string,"consented_by": string,"id": string,"patient_id": string,"scope": NonNullable<Json>,"withdrawn_at": string | null
                  }
                  Insert: {
                    "care_team_id": string,"consent_version": string,"consented_at"?: string,"consented_by": string,"id"?: string,"patient_id": string,"scope"?: NonNullable<Json>,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "care_team_id"?: string,"consent_version"?: string,"consented_at"?: string,"consented_by"?: string,"id"?: string,"patient_id"?: string,"scope"?: NonNullable<Json>,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_consents_care_team_id_fkey"
      columns: ["care_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_consents_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_invitations": {
                  Row: {
                    "care_team_id": string,"code": string,"code_hash": string | null,"code_hint": string | null,"created_at": string,"created_by": string,"expires_at": string,"id": string,"patient_id": string,"redeemed_at": string | null,"redeemed_by": string | null,"revoked_at": string | null,"status": Database["public"]['Enums']["invitation_status"]
                  }
                  Insert: {
                    "care_team_id": string,"code": string,"code_hash"?: string | null,"code_hint"?: string | null,"created_at"?: string,"created_by": string,"expires_at"?: string,"id"?: string,"patient_id": string,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"revoked_at"?: string | null,"status"?: Database["public"]['Enums']["invitation_status"]
                  }
                  Update: {
                    "care_team_id"?: string,"code"?: string,"code_hash"?: string | null,"code_hint"?: string | null,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"patient_id"?: string,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"revoked_at"?: string | null,"status"?: Database["public"]['Enums']["invitation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_invitations_care_team_id_fkey"
      columns: ["care_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_invitations_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"external_data_sources": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"external_reference": string | null,"id": string,"name": string,"organisation_id": string,"source_type": Database["public"]['Enums']["external_source_type"],"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"external_reference"?: string | null,"id"?: string,"name": string,"organisation_id": string,"source_type": Database["public"]['Enums']["external_source_type"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"external_reference"?: string | null,"id"?: string,"name"?: string,"organisation_id"?: string,"source_type"?: Database["public"]['Enums']["external_source_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_data_sources_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"external_import_batches": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"created_by": string | null,"error_summary": string | null,"external_run_id": string | null,"id": string,"matched_count": number,"rejected_count": number,"row_count": number,"source_id": string,"started_at": string | null,"status": Database["public"]['Enums']["ingestion_batch_status"]
                  }
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"error_summary"?: string | null,"external_run_id"?: string | null,"id"?: string,"matched_count"?: number,"rejected_count"?: number,"row_count"?: number,"source_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["ingestion_batch_status"]
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"error_summary"?: string | null,"external_run_id"?: string | null,"id"?: string,"matched_count"?: number,"rejected_count"?: number,"row_count"?: number,"source_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["ingestion_batch_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_import_batches_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "external_data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"external_import_records": {
                  Row: {
                    "batch_id": string,"content_hash": string | null,"error_message": string | null,"external_record_id": string,"id": string,"match_status": string,"matched_at": string | null,"patient_id": string | null,"payload": NonNullable<Json>,"received_at": string,"record_type": string
                  }
                  Insert: {
                    "batch_id": string,"content_hash"?: string | null,"error_message"?: string | null,"external_record_id": string,"id"?: string,"match_status"?: string,"matched_at"?: string | null,"patient_id"?: string | null,"payload": NonNullable<Json>,"received_at"?: string,"record_type": string
                  }
                  Update: {
                    "batch_id"?: string,"content_hash"?: string | null,"error_message"?: string | null,"external_record_id"?: string,"id"?: string,"match_status"?: string,"matched_at"?: string | null,"patient_id"?: string | null,"payload"?: NonNullable<Json>,"received_at"?: string,"record_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_import_records_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "external_import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "external_import_records_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_up_events": {
                  Row: {
                    "appointment_id": string | null,"attempted_at": string,"created_at": string,"id": string,"next_steps": string | null,"outcome": string,"patient_id": string,"recorded_by": string
                  }
                  Insert: {
                    "appointment_id"?: string | null,"attempted_at"?: string,"created_at"?: string,"id"?: string,"next_steps"?: string | null,"outcome": string,"patient_id": string,"recorded_by": string
                  }
                  Update: {
                    "appointment_id"?: string | null,"attempted_at"?: string,"created_at"?: string,"id"?: string,"next_steps"?: string | null,"outcome"?: string,"patient_id"?: string,"recorded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_events_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_events_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_up_task_events": {
                  Row: {
                    "actor_id": string,"created_at": string,"event_type": string,"from_status": Database["public"]['Enums']["follow_up_task_status"] | null,"id": string,"metadata": NonNullable<Json>,"patient_id": string,"task_id": string,"to_status": Database["public"]['Enums']["follow_up_task_status"]
                  }
                  Insert: {
                    "actor_id": string,"created_at"?: string,"event_type": string,"from_status"?: Database["public"]['Enums']["follow_up_task_status"] | null,"id"?: string,"metadata"?: NonNullable<Json>,"patient_id": string,"task_id": string,"to_status": Database["public"]['Enums']["follow_up_task_status"]
                  }
                  Update: {
                    "actor_id"?: string,"created_at"?: string,"event_type"?: string,"from_status"?: Database["public"]['Enums']["follow_up_task_status"] | null,"id"?: string,"metadata"?: NonNullable<Json>,"patient_id"?: string,"task_id"?: string,"to_status"?: Database["public"]['Enums']["follow_up_task_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_task_events_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_task_events_task_id_patient_id_fkey"
      columns: ["task_id","patient_id"]
isOneToOne: false
      referencedRelation: "follow_up_tasks"
      referencedColumns: ["id","patient_id"]
    }
                  ]
                },"follow_up_tasks": {
                  Row: {
                    "appointment_id": string | null,"closed_at": string | null,"closed_by": string | null,"closure_note": string | null,"created_at": string,"created_by": string,"due_at": string,"id": string,"idempotency_key": string | null,"next_action": string,"owner_id": string | null,"patient_id": string,"priority": Database["public"]['Enums']["follow_up_priority"],"priority_source": string,"reason": string,"status": Database["public"]['Enums']["follow_up_task_status"],"updated_at": string
                  }
                  Insert: {
                    "appointment_id"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closure_note"?: string | null,"created_at"?: string,"created_by": string,"due_at": string,"id"?: string,"idempotency_key"?: string | null,"next_action": string,"owner_id"?: string | null,"patient_id": string,"priority"?: Database["public"]['Enums']["follow_up_priority"],"priority_source": string,"reason": string,"status"?: Database["public"]['Enums']["follow_up_task_status"],"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closure_note"?: string | null,"created_at"?: string,"created_by"?: string,"due_at"?: string,"id"?: string,"idempotency_key"?: string | null,"next_action"?: string,"owner_id"?: string | null,"patient_id"?: string,"priority"?: Database["public"]['Enums']["follow_up_priority"],"priority_source"?: string,"reason"?: string,"status"?: Database["public"]['Enums']["follow_up_task_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_tasks_appointment_id_patient_id_fkey"
      columns: ["appointment_id","patient_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","patient_id"]
    },{
      foreignKeyName: "follow_up_tasks_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_tasks_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"medications": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dosage": string,"end_date": string | null,"id": string,"instructions": string,"name": string,"patient_id": string,"start_date": string,"status": Database["public"]['Enums']["medication_status"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dosage": string,"end_date"?: string | null,"id"?: string,"instructions": string,"name": string,"patient_id": string,"start_date": string,"status"?: Database["public"]['Enums']["medication_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dosage"?: string,"end_date"?: string | null,"id"?: string,"instructions"?: string,"name"?: string,"patient_id"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["medication_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "medications_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "attempts": number,"channel": string,"created_at": string,"delivered_at": string | null,"endpoint_id": string | null,"id": string,"last_error": string | null,"outbox_event_id": string,"provider_message_id": string | null,"recipient_id": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"channel": string,"created_at"?: string,"delivered_at"?: string | null,"endpoint_id"?: string | null,"id"?: string,"last_error"?: string | null,"outbox_event_id": string,"provider_message_id"?: string | null,"recipient_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"delivered_at"?: string | null,"endpoint_id"?: string | null,"id"?: string,"last_error"?: string | null,"outbox_event_id"?: string,"provider_message_id"?: string | null,"recipient_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_endpoint_id_fkey"
      columns: ["endpoint_id"]
isOneToOne: false
      referencedRelation: "notification_endpoints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_outbox_event_id_fkey"
      columns: ["outbox_event_id"]
isOneToOne: false
      referencedRelation: "outbox_events"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_endpoints": {
                  Row: {
                    "channel": string,"created_at": string,"endpoint": string,"id": string,"label": string | null,"last_seen_at": string | null,"recipient_id": string,"revoked_at": string | null,"updated_at": string,"verified_at": string | null
                  }
                  Insert: {
                    "channel": string,"created_at"?: string,"endpoint": string,"id"?: string,"label"?: string | null,"last_seen_at"?: string | null,"recipient_id": string,"revoked_at"?: string | null,"updated_at"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"label"?: string | null,"last_seen_at"?: string | null,"recipient_id"?: string,"revoked_at"?: string | null,"updated_at"?: string,"verified_at"?: string | null
                  }
                  Relationships: [

                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"notification_type": string,"patient_id": string | null,"read_at": string | null,"recipient_id": string,"title": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"notification_type": string,"patient_id"?: string | null,"read_at"?: string | null,"recipient_id": string,"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"notification_type"?: string,"patient_id"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"organisations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"outbox_events": {
                  Row: {
                    "aggregate_id": string | null,"aggregate_type": string,"attempts": number,"available_at": string,"claimed_at": string | null,"created_at": string,"delivered_at": string | null,"id": string,"idempotency_key": string | null,"last_error": string | null,"organisation_id": string | null,"payload": NonNullable<Json>,"status": Database["public"]['Enums']["outbox_status"],"topic": string
                  }
                  Insert: {
                    "aggregate_id"?: string | null,"aggregate_type": string,"attempts"?: number,"available_at"?: string,"claimed_at"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"last_error"?: string | null,"organisation_id"?: string | null,"payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["outbox_status"],"topic": string
                  }
                  Update: {
                    "aggregate_id"?: string | null,"aggregate_type"?: string,"attempts"?: number,"available_at"?: string,"claimed_at"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"last_error"?: string | null,"organisation_id"?: string | null,"payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["outbox_status"],"topic"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outbox_events_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_care_team_connections": {
                  Row: {
                    "care_team_id": string,"connected_at": string,"created_by": string | null,"id": string,"patient_id": string,"status": Database["public"]['Enums']["connection_status"],"withdrawn_at": string | null
                  }
                  Insert: {
                    "care_team_id": string,"connected_at"?: string,"created_by"?: string | null,"id"?: string,"patient_id": string,"status"?: Database["public"]['Enums']["connection_status"],"withdrawn_at"?: string | null
                  }
                  Update: {
                    "care_team_id"?: string,"connected_at"?: string,"created_by"?: string | null,"id"?: string,"patient_id"?: string,"status"?: Database["public"]['Enums']["connection_status"],"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_care_team_connections_care_team_id_fkey"
      columns: ["care_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_care_team_connections_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_group_members": {
                  Row: {
                    "created_at": string,"group_id": string,"patient_id": string
                  }
                  Insert: {
                    "created_at"?: string,"group_id": string,"patient_id": string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "patient_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_group_members_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_groups": {
                  Row: {
                    "assigned_doctor_id": string | null,"assigned_staff_id": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"name": string,"organisation_id": string
                  }
                  Insert: {
                    "assigned_doctor_id"?: string | null,"assigned_staff_id"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"name": string,"organisation_id": string
                  }
                  Update: {
                    "assigned_doctor_id"?: string | null,"assigned_staff_id"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"name"?: string,"organisation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_groups_assigned_doctor_id_fkey"
      columns: ["assigned_doctor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_groups_assigned_staff_id_fkey"
      columns: ["assigned_staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_groups_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"patients": {
                  Row: {
                    "assigned_doctor_id": string | null,"assigned_staff_id": string | null,"auth_user_id": string | null,"condition": string | null,"created_at": string,"date_of_birth": string | null,"email": string | null,"first_name": string,"id": string,"last_name": string,"notes": string | null,"organisation_id": string,"patient_code": string,"phone": string | null,"updated_at": string
                  }
                  Insert: {
                    "assigned_doctor_id"?: string | null,"assigned_staff_id"?: string | null,"auth_user_id"?: string | null,"condition"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"first_name": string,"id"?: string,"last_name": string,"notes"?: string | null,"organisation_id": string,"patient_code"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "assigned_doctor_id"?: string | null,"assigned_staff_id"?: string | null,"auth_user_id"?: string | null,"condition"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"notes"?: string | null,"organisation_id"?: string,"patient_code"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patients_assigned_doctor_id_fkey"
      columns: ["assigned_doctor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_assigned_staff_id_fkey"
      columns: ["assigned_staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"age": number | null,"created_at": string,"department": string | null,"email": string,"experience_years": number | null,"full_name": string,"id": string,"location": string | null,"organisation_id": string | null,"phone": string | null,"primary_care_team_id": string | null,"role": Database["public"]['Enums']["profile_role"],"specialty": string | null,"staff_code": string | null,"updated_at": string,"workplace": string | null
                  }
                  Insert: {
                    "active"?: boolean,"age"?: number | null,"created_at"?: string,"department"?: string | null,"email"?: string,"experience_years"?: number | null,"full_name"?: string,"id": string,"location"?: string | null,"organisation_id"?: string | null,"phone"?: string | null,"primary_care_team_id"?: string | null,"role"?: Database["public"]['Enums']["profile_role"],"specialty"?: string | null,"staff_code"?: string | null,"updated_at"?: string,"workplace"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"age"?: number | null,"created_at"?: string,"department"?: string | null,"email"?: string,"experience_years"?: number | null,"full_name"?: string,"id"?: string,"location"?: string | null,"organisation_id"?: string | null,"phone"?: string | null,"primary_care_team_id"?: string | null,"role"?: Database["public"]['Enums']["profile_role"],"specialty"?: string | null,"staff_code"?: string | null,"updated_at"?: string,"workplace"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_primary_care_team_id_fkey"
      columns: ["primary_care_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "appointment_id": string | null,"approved_by": string | null,"channel": string,"created_at": string,"created_by": string | null,"id": string,"message": string,"patient_id": string,"send_at": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "appointment_id"?: string | null,"approved_by"?: string | null,"channel": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"message": string,"patient_id": string,"send_at": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "appointment_id"?: string | null,"approved_by"?: string | null,"channel"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"message"?: string,"patient_id"?: string,"send_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"file_name": string,"file_path": string,"id": string,"mime_type": string | null,"patient_id": string,"test_id": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"file_name": string,"file_path": string,"id"?: string,"mime_type"?: string | null,"patient_id": string,"test_id": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"file_path"?: string,"id"?: string,"mime_type"?: string | null,"patient_id"?: string,"test_id"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_test_id_fkey"
      columns: ["test_id"]
isOneToOne: false
      referencedRelation: "tests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_test_patient_fk"
      columns: ["test_id","patient_id"]
isOneToOne: false
      referencedRelation: "tests"
      referencedColumns: ["id","patient_id"]
    }
                  ]
                },"staff_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"care_team_id": string,"created_at": string,"created_by": string,"expires_at": string,"id": string,"status": Database["public"]['Enums']["invitation_status"],"target_email": string,"target_role": Database["public"]['Enums']["profile_role"],"token_hash": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"care_team_id": string,"created_at"?: string,"created_by": string,"expires_at": string,"id"?: string,"status"?: Database["public"]['Enums']["invitation_status"],"target_email": string,"target_role": Database["public"]['Enums']["profile_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"care_team_id"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"status"?: Database["public"]['Enums']["invitation_status"],"target_email"?: string,"target_role"?: Database["public"]['Enums']["profile_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invitations_care_team_id_fkey"
      columns: ["care_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"tests": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"notes": string | null,"patient_id": string,"status": Database["public"]['Enums']["test_status"],"test_date": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"patient_id": string,"status"?: Database["public"]['Enums']["test_status"],"test_date": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"patient_id"?: string,"status"?: Database["public"]['Enums']["test_status"],"test_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tests_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_staff_invitation":
{ Args: { "invitation_token": string }; Returns: string
                           },
"can_access_patient":
{ Args: { "target_patient_id": string }; Returns: boolean
                           },
"claim_outbox_events":
{ Args: { "batch_size"?: number }; Returns: {
              "aggregate_id": string | null,
"aggregate_type": string,
"attempts": number,
"available_at": string,
"claimed_at": string | null,
"created_at": string,
"delivered_at": string | null,
"id": string,
"idempotency_key": string | null,
"last_error": string | null,
"organisation_id": string | null,
"payload": NonNullable<Json>,
"status": Database["public"]['Enums']["outbox_status"],
"topic": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "outbox_events"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_outbox_event":
{ Args: { "event_id": string,"expected_attempt": number }; Returns: boolean
                           },
"create_connection_invitation":
{ Args: { "invitation_ttl_hours"?: number,"target_care_team_id": string,"target_patient_id": string }; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"create_connection_qr_invitation":
{ Args: { "invitation_ttl_hours"?: number,"target_care_team_id": string,"target_patient_id": string }; Returns: {
              "care_team_id": string,"code": string,"code_hint": string,"expires_at": string,"invitation_id": string,"patient_id": string,"qr_payload": string
            }[]
                           },
"create_follow_up_task":
{ Args: { "action_next"?: string,"owner_profile_id"?: string,"priority_source"?: string,"request_key": string,"target_appointment_id"?: string,"target_due_at": string,"target_patient_id": string,"task_priority"?: Database["public"]['Enums']["follow_up_priority"],"task_reason": string }; Returns: string
                           },
"create_staff_invitation":
{ Args: { "invitation_ttl_hours"?: number,"target_care_team_id": string,"target_email": string,"target_role": Database["public"]['Enums']["profile_role"] }; Returns: string
                           },
"current_organisation_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_patient_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_profile_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["profile_role"]
                           },
"enqueue_outbox_event":
{ Args: { "event_aggregate_id": string,"event_aggregate_type": string,"event_idempotency_key"?: string,"event_patient_id": string,"event_payload": Json,"event_topic": string }; Returns: string
                           },
"fail_outbox_event":
{ Args: { "event_id": string,"expected_attempt": number,"failure_message": string,"retry_after_seconds"?: number }; Returns: boolean
                           },
"get_patient_connectivity_snapshot":
{ Args: Record<PropertyKey, never>; Returns: {
              "care_team_id": string,"connected_at": string,"connection_id": string,"connection_status": Database["public"]['Enums']["connection_status"],"consent_version": string,"consented_at": string,"organisation_id": string,"patient_id": string
            }[]
                           },
"is_staff_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_follow_up_queue":
{ Args: { "due_before"?: string,"result_limit"?: number,"target_owner_id"?: string,"target_status"?: Database["public"]['Enums']["follow_up_task_status"] }; Returns: {
              "appointment_id": string,"appointment_scheduled_at": string,"appointment_status": Database["public"]['Enums']["appointment_status"],"created_at": string,"due_at": string,"is_overdue": boolean,"next_action": string,"owner_id": string,"owner_name": string,"patient_code": string,"patient_first_name": string,"patient_id": string,"patient_last_name": string,"priority": Database["public"]['Enums']["follow_up_priority"],"priority_source": string,"reason": string,"status": Database["public"]['Enums']["follow_up_task_status"],"task_id": string,"updated_at": string
            }[]
                           },
"profile_can_access_patient":
{ Args: { "target_patient_id": string,"target_profile_id": string }; Returns: boolean
                           },
"redeem_connection_code":
{ Args: { "invitation_code": string }; Returns: string
                           },
"redeem_connection_qr_payload":
{ Args: { "qr_payload": string }; Returns: string
                           },
"register_notification_endpoint":
{ Args: { "target_channel": string,"target_endpoint": string,"target_label"?: string }; Returns: string
                           },
"respond_to_appointment":
{ Args: { "requested_scheduled_at"?: string,"response": string,"target_appointment_id": string }; Returns: string
                           },
"revoke_notification_endpoint":
{ Args: { "endpoint_id": string }; Returns: boolean
                           },
"update_follow_up_task":
{ Args: { "change_owner"?: boolean,"closure_note"?: string,"expected_updated_at": string,"new_due_at"?: string,"new_next_action"?: string,"new_owner_id"?: string,"new_status"?: Database["public"]['Enums']["follow_up_task_status"],"task_id": string }; Returns: string
                           },
"withdraw_connection":
{ Args: { "target_connection_id": string }; Returns: undefined
                           },
"write_audit_event":
{ Args: { "event_action": string,"event_entity_id": string,"event_entity_type": string,"event_metadata"?: Json,"target_patient_id": string }; Returns: string
                           }
          }
          Enums: {
            "appointment_status": "upcoming"|"completed"|"missed"|"cancelled"|"overdue","care_plan_status": "active"|"completed"|"paused","connection_status": "active"|"withdrawn"|"revoked","external_source_type": "emr"|"lab"|"spreadsheet"|"register"|"api","follow_up_priority": "low"|"normal"|"high"|"urgent","follow_up_task_status": "open"|"in_progress"|"completed"|"cancelled","ingestion_batch_status": "queued"|"processing"|"completed"|"partial"|"failed","invitation_status": "pending"|"redeemed"|"revoked"|"expired","medication_status": "current"|"past","outbox_status": "pending"|"processing"|"delivered"|"dead_letter","profile_role": "pending"|"doctor"|"staff"|"care_coordinator"|"org_admin"|"platform_admin","test_status": "pending"|"completed"|"overdue"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"storage": {
          Tables: {
            "buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"lifecycle_configuration": Json | null,"lifecycle_configuration_generation": string | null,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null,"versioning_status": string
                  }
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Relationships: [

                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [

                  ]
                },"objects": {
                  Row: {
                    "archived_at": string | null,"bucket_id": string | null,"created_at": string | null,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  Insert: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string }; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string,"raw_prefix_param"?: string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delete_markers"?: string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"next_token_archived_at"?: string,"next_token_version"?: string,"noncurrent_versions"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"search":
{ Args: { "bucketname": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string,"p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string,"p_start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string,"start_after_archived_at"?: string,"start_after_is_continuation"?: boolean,"start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "appointment_status": ["upcoming", "completed", "missed", "cancelled", "overdue"],"care_plan_status": ["active", "completed", "paused"],"connection_status": ["active", "withdrawn", "revoked"],"external_source_type": ["emr", "lab", "spreadsheet", "register", "api"],"follow_up_priority": ["low", "normal", "high", "urgent"],"follow_up_task_status": ["open", "in_progress", "completed", "cancelled"],"ingestion_batch_status": ["queued", "processing", "completed", "partial", "failed"],"invitation_status": ["pending", "redeemed", "revoked", "expired"],"medication_status": ["current", "past"],"outbox_status": ["pending", "processing", "delivered", "dead_letter"],"profile_role": ["pending", "doctor", "staff", "care_coordinator", "org_admin", "platform_admin"],"test_status": ["pending", "completed", "overdue"]
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
} as const
