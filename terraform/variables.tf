variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-south1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-south1-a"
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

variable "slack_signing_secret" {
  description = "Slack signing secret for Events API verification"
  type        = string
  sensitive   = true
}

variable "slack_authed_user_id" {
  description = "Slack user ID of the person who authorized the app"
  type        = string
  default     = ""
}

variable "ai_provider" {
  description = "AI provider name (anthropic or openai)"
  type        = string
  default     = "anthropic"
}

variable "ai_api_key" {
  description = "AI provider API key for OpenClaw"
  type        = string
  sensitive   = true
}

variable "gateway_token" {
  description = "OpenClaw gateway auth token"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Base domain for tenant subdomains (e.g. app.yourdomain.com)"
  type        = string
}

variable "dns_zone_name" {
  description = "Cloud DNS managed zone name"
  type        = string
}

variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate registration"
  type        = string
}

variable "platform_url" {
  description = "Base URL of the One Assist platform (for agent sync)"
  type        = string
  default     = ""
}

variable "initial_skills_json" {
  description = "JSON-encoded array of skills to write on first boot"
  type        = string
  default     = "[]"
}

variable "agent_id" {
  description = "Agent UUID (for sync endpoint)"
  type        = string
}

variable "org_id" {
  description = "Organization UUID (for resource identification)"
  type        = string
}
