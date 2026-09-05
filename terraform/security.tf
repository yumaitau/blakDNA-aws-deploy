resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Restricted HTTPS ingress to blakDNA"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${local.name}-alb" }
}

resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks"
  description = "Private blakDNA Fargate tasks"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${local.name}-tasks" }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "Private PostgreSQL access from blakDNA tasks"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${local.name}-database" }
}

resource "aws_vpc_security_group_ingress_rule" "alb" {
  for_each = toset(var.allowed_ingress_cidrs)

  security_group_id = aws_security_group.alb.id
  description       = "HTTPS"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value

  lifecycle {
    precondition {
      condition     = var.allow_internet_ingress || (each.value != "0.0.0.0/0" && each.value != "::/0")
      error_message = "World-open ALB ingress requires allow_internet_ingress=true."
    }
  }
}

resource "aws_vpc_security_group_egress_rule" "alb_to_web" {
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB to web task"
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.tasks.id
}

resource "aws_vpc_security_group_ingress_rule" "web_from_alb" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "ALB to web task"
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id
}

#trivy:ignore:AVD-AWS-0104 Fargate needs outbound TLS for Marketplace ECR, License Manager, Secrets Manager, and buyer Hermes.
resource "aws_vpc_security_group_egress_rule" "tasks_https" {
  security_group_id = aws_security_group.tasks.id
  description       = "AWS APIs and buyer Hermes endpoint"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "tasks_dns_udp" {
  security_group_id = aws_security_group.tasks.id
  description       = "VPC DNS over UDP"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
  cidr_ipv4         = var.vpc_cidr
}

resource "aws_vpc_security_group_egress_rule" "tasks_dns_tcp" {
  security_group_id = aws_security_group.tasks.id
  description       = "VPC DNS over TCP"
  from_port         = 53
  to_port           = 53
  ip_protocol       = "tcp"
  cidr_ipv4         = var.vpc_cidr
}

resource "aws_vpc_security_group_egress_rule" "tasks_to_database" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "PostgreSQL TLS"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.database.id
}

resource "aws_vpc_security_group_ingress_rule" "database_from_tasks" {
  security_group_id            = aws_security_group.database.id
  description                  = "PostgreSQL from tasks"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.tasks.id
}
