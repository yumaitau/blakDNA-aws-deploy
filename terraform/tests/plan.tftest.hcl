mock_provider "aws" {
  override_during = plan
  mock_data "aws_availability_zones" { defaults = { names = ["ap-southeast-2a", "ap-southeast-2b"] } }
  mock_data "aws_caller_identity" { defaults = { account_id = "123456789012" } }
  mock_data "aws_partition" { defaults = { partition = "aws" } }
  mock_data "aws_iam_policy_document" { defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" } }
  mock_resource "aws_db_instance" {
    defaults = {
      address            = "blakdna.example.rds.amazonaws.com"
      port               = 5432
      master_user_secret = [{ secret_arn = "arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:rds/blakdna", secret_status = "active", kms_key_id = "alias/aws/secretsmanager" }]
    }
  }
}

mock_provider "random" { override_during = plan }

variables {
  smtp_relay_cidrs      = ["203.0.113.10/32"]
  expected_account_id   = "123456789012"
  container_image       = "111111111111.dkr.ecr.us-east-1.amazonaws.com/validation-only@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  certificate_arn       = "arn:aws:acm:ap-southeast-2:123456789012:certificate/00000000-0000-4000-8000-000000000000"
  application_hostname  = "blakdna.buyer.example"
  route53_zone_id       = "Z0000000000000000000"
  hermes_base_url       = "https://hermes.buyer.example"
  runtime_secret_arn    = "arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:runtime"
  allowed_ingress_cidrs = ["203.0.113.0/24"]
}

run "secure_buyer_baseline" {
  command = plan

  assert {
    condition     = aws_ecs_service.web.desired_count == 0 && aws_ecs_service.worker.desired_count == 0
    error_message = "First apply must not start services before preflight."
  }
  assert {
    condition     = contains([for secret in local.common_secrets : secret.name], "BLAKDNA_ENCRYPTION_KEY") && contains([for secret in local.common_secrets : secret.name], "BETTER_AUTH_SECRET")
    error_message = "Authentication and persistent secret encryption must be configured."
  }

  assert {
    condition     = aws_db_instance.this.storage_encrypted && !aws_db_instance.this.publicly_accessible
    error_message = "PostgreSQL must be encrypted and private."
  }
  assert {
    condition     = aws_db_instance.this.manage_master_user_password
    error_message = "RDS must manage its password in Secrets Manager."
  }
  assert {
    condition     = aws_ecs_service.web.network_configuration[0].assign_public_ip == false
    error_message = "Web tasks must not receive public IPs."
  }
  assert {
    condition     = local.container_hardening.readonlyRootFilesystem
    error_message = "Containers must use a read-only root filesystem."
  }
  assert {
    condition     = contains(local.container_hardening.linuxParameters.capabilities.drop, "ALL")
    error_message = "Containers must drop all Linux capabilities."
  }
  assert {
    condition     = aws_flow_log.this.traffic_type == "ALL"
    error_message = "VPC flow logs must capture all traffic."
  }
  assert {
    condition     = aws_lb.this.access_logs[0].enabled
    error_message = "ALB access logging must remain enabled."
  }
  assert {
    condition     = contains(local.common_environment, { name = "BETTER_AUTH_URL", value = "https://blakdna.buyer.example" })
    error_message = "Runtime tasks must carry the trusted human authentication origin."
  }
}

run "reject_world_open_ingress" {
  command = plan
  variables { allowed_ingress_cidrs = ["0.0.0.0/0"] }
  expect_failures = [aws_vpc_security_group_ingress_rule.alb]
}

run "reject_invalid_account" {
  command = plan
  variables { expected_account_id = "not-an-account" }
  expect_failures = [var.expected_account_id]
}

run "reject_world_open_smtp" {
  command = plan
  variables { smtp_relay_cidrs = ["0.0.0.0/0"] }
  expect_failures = [var.smtp_relay_cidrs]
}
