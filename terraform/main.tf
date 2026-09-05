provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.expected_account_id]

  default_tags {
    tags = {
      Application = "blakDNA"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  name                = "${var.name_prefix}-${var.environment}"
  availability_zones  = slice(data.aws_availability_zones.available.names, 0, 2)
  database_secret_arn = aws_db_instance.this.master_user_secret[0].secret_arn
  database_environment = [
    { name = "DATABASE_HOST", value = aws_db_instance.this.address },
    { name = "DATABASE_PORT", value = tostring(aws_db_instance.this.port) },
    { name = "DATABASE_NAME", value = var.database_name },
    { name = "DATABASE_USER", value = var.database_username },
    { name = "DATABASE_SSLMODE", value = "require" },
  ]
  common_environment = concat(local.database_environment, [
    { name = "BETTER_AUTH_URL", value = "https://${var.application_hostname}" },
    { name = "SMTP_PORT", value = "465" },
    { name = "HERMES_BASE_URL", value = var.hermes_base_url },
    { name = "HOSTNAME", value = "0.0.0.0" },
  ])
  common_secrets = concat([
    { name = "DATABASE_PASSWORD", valueFrom = "${local.database_secret_arn}:password::" },
    { name = "BLAKDNA_NOTIFICATION_SMTP_HOSTS", valueFrom = "${var.runtime_secret_arn}:SMTP_HOST::" },
    ], [for key in ["BETTER_AUTH_SECRET", "BLAKDNA_ENCRYPTION_KEY", "HERMES_API_TOKEN", "SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD"] : {
      name = key, valueFrom = "${var.runtime_secret_arn}:${key}::"
  }])
  container_hardening = {
    readonlyRootFilesystem = true
    user                   = "1001"
    linuxParameters = {
      initProcessEnabled = true
      capabilities = {
        add  = []
        drop = ["ALL"]
      }
    }
  }
}
