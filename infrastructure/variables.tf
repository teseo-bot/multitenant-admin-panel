variable "gcp_project_id" {
  description = "El ID del proyecto de Google Cloud."
  type        = string
}

variable "gcp_region" {
  description = "La región de GCP donde se desplegarán los recursos."
  type        = string
  default     = "us-central1"
}

variable "db_instance_name" {
  description = "El nombre de la instancia de Cloud SQL."
  type        = string
  default     = "teseo-ai-crm-db-prod"
}

variable "db_password" {
  description = "La contraseña para el usuario 'postgres' de la base de datos."
  type        = string
  sensitive   = true
}
