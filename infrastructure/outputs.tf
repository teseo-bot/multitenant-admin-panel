output "db_private_ip_address" {
  description = "La dirección IP privada de la instancia de Cloud SQL."
  value       = google_sql_database_instance.default.private_ip_address
}
