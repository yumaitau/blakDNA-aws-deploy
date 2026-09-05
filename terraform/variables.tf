variable "smtp_relay_cidrs" {
  type        = list(string)
  description = "Approved IPv4 networks for the TLS SMTP relay; keep these aligned with the relay hostname."
  validation {
    condition     = length(var.smtp_relay_cidrs) > 0 && alltrue([for cidr in var.smtp_relay_cidrs : can(cidrnetmask(cidr)) && try(tonumber(split("/", cidr)[1]) >= 8, false)])
    error_message = "Supply explicit IPv4 SMTP relay CIDRs with prefix length 8 or greater; unrestricted egress is not allowed."
  }
}

variable "expected_account_id" {
  type        = string
  description = "Approved buyer AWS account. Provider refuses all other accounts."
  validation {
    condition     = can(regex("^[0-9]{12}$", var.expected_account_id))
    error_message = "expected_account_id must be the approved 12-digit buyer account ID."
  }
}

variable "name_prefix" {
  type        = string
  description = "Short resource-name prefix."
  default     = "blakdna"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,9}$", var.name_prefix))
    error_message = "name_prefix must be 2-10 lowercase letters, digits, or hyphens."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment name."
  default     = "buyer"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,9}$", var.environment))
    error_message = "environment must be 2-10 lowercase letters, digits, or hyphens."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS Region for buyer-owned resources."
  default     = "ap-southeast-2"
}

variable "container_image" {
  type        = string
  description = "Immutable AWS Marketplace ECR image reference using @sha256."
  validation {
    condition     = can(regex("^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$", var.container_image))
    error_message = "container_image must be an immutable AWS ECR digest reference."
  }
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN in aws_region."
  validation {
    condition     = can(regex("^arn:[^:]+:acm:[^:]+:[0-9]{12}:certificate/.+$", var.certificate_arn))
    error_message = "certificate_arn must be an ACM certificate ARN."
  }
}

variable "application_hostname" {
  type        = string
  description = "DNS hostname covered by certificate_arn."
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+[a-z0-9]$", var.application_hostname))
    error_message = "application_hostname must be a DNS hostname."
  }
}

variable "route53_zone_id" {
  type        = string
  description = "Buyer Route 53 hosted zone ID for application_hostname."
}

variable "hermes_base_url" {
  type        = string
  description = "Buyer-controlled Hermes HTTPS endpoint."
  validation {
    condition     = can(regex("^https://", var.hermes_base_url))
    error_message = "hermes_base_url must use HTTPS."
  }
}

variable "runtime_secret_arn" {
  type        = string
  description = "Buyer-managed JSON secret containing authentication, encryption, outbound Hermes and SMTP configuration. Never pass secret values to Terraform."
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:.+$", var.runtime_secret_arn))
    error_message = "runtime_secret_arn must identify a Secrets Manager secret."
  }
}

variable "runtime_secret_kms_key_arns" {
  type        = list(string)
  description = "Explicit customer-managed KMS keys protecting the supplied runtime secret; empty for the AWS-managed Secrets Manager key."
  default     = []
  validation {
    condition     = alltrue([for key in var.runtime_secret_kms_key_arns : can(regex("^arn:aws:kms:[a-z0-9-]+:[0-9]{12}:key/.+$", key))])
    error_message = "Supply specific KMS key ARNs, never wildcard resources."
  }
}

variable "services_enabled" {
  type        = bool
  description = "Enable services only after the documented licensing and migration preflight passes for this image."
  default     = false
}

variable "allowed_ingress_cidrs" {
  type        = list(string)
  description = "Office, VPN, or trusted client IPv4 CIDRs permitted to reach HTTPS."
  default     = ["127.0.0.1/32"]
  validation {
    condition     = length(var.allowed_ingress_cidrs) > 0 && alltrue([for cidr in var.allowed_ingress_cidrs : can(cidrnetmask(cidr))])
    error_message = "allowed_ingress_cidrs must contain valid CIDRs."
  }
}

variable "allow_internet_ingress" {
  type        = bool
  description = "Explicit acknowledgement required for 0.0.0.0/0 ingress."
  default     = false
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR for the isolated buyer VPC."
  default     = "10.42.0.0/16"
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use one NAT gateway to reduce cost; disable for per-AZ production egress."
  default     = true
}

variable "cpu_architecture" {
  type        = string
  description = "Fargate CPU architecture supported by the published multi-arch image."
  default     = "X86_64"
  validation {
    condition     = contains(["ARM64", "X86_64"], var.cpu_architecture)
    error_message = "cpu_architecture must be ARM64 or X86_64."
  }
}

variable "web_cpu" {
  type    = number
  default = 1024
}
variable "web_memory" {
  type    = number
  default = 2048
}
variable "worker_cpu" {
  type    = number
  default = 512
}
variable "worker_memory" {
  type    = number
  default = 1024
}
variable "web_desired_count" {
  type    = number
  default = 1
}
variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "database_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "blakdna"
}

variable "database_username" {
  type        = string
  description = "PostgreSQL master username; password is generated and rotated by RDS."
  default     = "blakdnaadmin"
}

variable "database_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.micro"
}

variable "database_allocated_storage" {
  type    = number
  default = 20
}
variable "database_max_allocated_storage" {
  type    = number
  default = 100
}
variable "database_backup_retention_days" {
  type    = number
  default = 7
}
variable "database_multi_az" {
  type    = bool
  default = true
}
variable "database_deletion_protection" {
  type    = bool
  default = true
}
variable "skip_final_database_snapshot" {
  type    = bool
  default = false
}
variable "load_balancer_deletion_protection" {
  type    = bool
  default = true
}
variable "force_destroy_log_bucket" {
  type    = bool
  default = false
}
variable "log_retention_days" {
  type    = number
  default = 365
}
variable "alb_log_retention_days" {
  type    = number
  default = 90
}

variable "alarm_notification_email" {
  type        = string
  description = "Optional email for CloudWatch alarm notifications."
  default     = ""
}
