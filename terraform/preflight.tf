resource "aws_ecs_task_definition" "preflight" {
  family                   = "${local.name}-preflight"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.web_cpu)
  memory                   = tostring(var.web_memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([
    merge(local.container_hardening, {
      name        = "preflight"
      image       = var.container_image
      essential   = true
      command     = ["node", "-e", file("${path.module}/../scripts/preflight.cjs")]
      environment = local.common_environment
      secrets     = local.common_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.web.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "preflight"
        }
      }
    })
  ])
  depends_on = [aws_iam_role_policy_attachment.execution, aws_iam_role_policy.execution_secrets]
}
