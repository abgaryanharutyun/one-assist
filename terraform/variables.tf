variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "tenant_id" {
  description = "Unique tenant identifier"
  type        = string
}

variable "slack_bot_token" {
  description = "Slack bot token"
  type        = string
  sensitive   = true
}

variable "slack_app_token" {
  description = "Slack app token"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for OpenClaw"
  type        = string
  sensitive   = true
}

variable "gateway_token" {
  description = "OpenClaw gateway auth token"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Base domain for tenant subdomains"
  type        = string
}
