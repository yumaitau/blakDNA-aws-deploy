resource "aws_vpc_security_group_egress_rule" "tasks_smtp" {
  for_each          = toset(var.smtp_relay_cidrs)
  security_group_id = aws_security_group.tasks.id
  description       = "Implicit TLS SMTP to the buyer-configured verification and notification relay"
  ip_protocol       = "tcp"
  from_port         = 465
  to_port           = 465
  cidr_ipv4         = each.value
}
