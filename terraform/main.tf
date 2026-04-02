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

resource "google_compute_address" "one-assist" {
  name   = "one-assist-ip-${var.tenant_id}"
  region = var.region
}

resource "google_compute_instance" "one-assist" {
  name         = "one-assist-${var.tenant_id}"
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
    slack_bot_token   = var.slack_bot_token
    slack_app_token   = var.slack_app_token
    anthropic_api_key = var.anthropic_api_key
    gateway_token     = var.gateway_token
    domain            = var.domain
  })

  labels = {
    tenant = var.tenant_id
    app    = "one-assist"
  }
}

resource "google_compute_firewall" "one-assist_https" {
  name    = "one-assist-https-${var.tenant_id}"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["443", "80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["one-assist"]
}
