resource "google_sql_database_instance" "default" {
  name             = var.db_instance_name
  database_version = "POSTGRES_15"
  region           = var.gcp_region

  settings {
    tier = "db-g1-small"
    ip_configuration {
      ipv4_enabled    = false
      private_network = "projects/${var.gcp_project_id}/global/networks/default"
    }
  }

  root_password = var.db_password
}

resource "random_password" "db_password" {
  length  = 16
  special = true
}
