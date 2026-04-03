terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "one-assist-tf-state"
    prefix = "tenants"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Use first 8 chars for short identifiers in resource names
locals {
  org_short    = substr(var.org_id, 0, 8)
  tenant_short = substr(var.tenant_id, 0, 8)
  name_prefix  = "oa-${local.org_short}-${local.tenant_short}"
  tenant_fqdn  = "${local.tenant_short}.${var.domain}"
}

resource "google_compute_address" "one-assist" {
  name   = "${local.name_prefix}-ip"
  region = var.region
}

# DNS A record for tenant subdomain
resource "google_dns_record_set" "tenant" {
  name         = "${local.tenant_fqdn}."
  type         = "A"
  ttl          = 300
  managed_zone = var.dns_zone_name
  rrdatas      = [google_compute_address.one-assist.address]
}

resource "google_compute_instance" "one-assist" {
  name         = "${local.name_prefix}-vm"
  machine_type = "e2-small"
  zone         = var.zone

  tags = ["one-assist", "http-server", "https-server"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 20
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.one-assist.address
    }
  }

  metadata_startup_script = templatefile("${path.module}/scripts/startup.sh", {
    tenant_id         = var.tenant_id
    tenant_fqdn       = local.tenant_fqdn
    slack_bot_token      = var.slack_bot_token
    slack_signing_secret  = var.slack_signing_secret
    slack_authed_user_id  = var.slack_authed_user_id
    ai_provider       = var.ai_provider
    ai_api_key        = var.ai_api_key
    instance_ip       = google_compute_address.one-assist.address
    gateway_token     = var.gateway_token
    letsencrypt_email = var.letsencrypt_email
    platform_url        = var.platform_url
    agent_id            = var.agent_id
    initial_skills_json = var.initial_skills_json
  })

  scheduling {
    provisioning_model  = "SPOT"
    preemptible         = true
    automatic_restart   = false
    instance_termination_action = "STOP"
  }

  labels = {
    tenant = var.tenant_id
    org    = var.org_id
    app    = "one-assist"
  }

  depends_on = [google_dns_record_set.tenant]
}

resource "google_compute_firewall" "one-assist_https" {
  name    = "${local.name_prefix}-fw"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["443", "80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["one-assist"]
}
