output "application_url" {
  description = "blakDNA HTTPS endpoint."
  value       = "https://${var.application_hostname}"
}

output "aws_account_id" {
  description = "Account receiving buyer-owned resources."
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" { value = var.aws_region }
output "preflight_task_definition" { value = aws_ecs_task_definition.preflight.arn }
output "application_subnet_ids" { value = aws_subnet.application[*].id }
output "task_security_group_id" { value = aws_security_group.tasks.id }
output "vpc_id" { value = aws_vpc.this.id }
output "load_balancer_arn" { value = aws_lb.this.arn }
output "data_key_arn" { value = aws_kms_key.this.arn }
output "ecs_cluster_name" { value = aws_ecs_cluster.this.name }
output "web_service_name" { value = aws_ecs_service.web.name }
output "worker_service_name" { value = aws_ecs_service.worker.name }
output "database_identifier" { value = aws_db_instance.this.identifier }

output "database_secret_arn" {
  description = "RDS-managed credential secret."
  value       = local.database_secret_arn
  sensitive   = true
}

output "alb_log_bucket" { value = aws_s3_bucket.alb_logs.id }
