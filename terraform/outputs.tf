output "vm_ip" {
  value = google_compute_address.openclaw.address
}

output "vm_name" {
  value = google_compute_instance.openclaw.name
}

output "openclaw_url" {
  value = "https://${var.tenant_id}.${var.domain}"
}
