output "vm_ip" {
  value = google_compute_address.one-assist.address
}

output "vm_name" {
  value = google_compute_instance.one-assist.name
}

output "openclaw_url" {
  value = "https://${local.tenant_fqdn}"
}
