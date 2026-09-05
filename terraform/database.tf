resource "random_id" "final_snapshot" {
  byte_length = 4
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-database"
  subnet_ids = aws_subnet.data[*].id
  tags       = { Name = "${local.name}-database" }
}

resource "aws_db_parameter_group" "this" {
  name   = "${local.name}-postgres16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

data "aws_iam_policy_document" "rds_monitoring_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name               = "${local.name}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume_role.json
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance" "this" {
  identifier = "${local.name}-postgres"

  engine         = "postgres"
  engine_version = "16.15"
  instance_class = var.database_instance_class
  db_name        = var.database_name
  username       = var.database_username
  port           = 5432

  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.this.arn
  allocated_storage             = var.database_allocated_storage
  max_allocated_storage         = var.database_max_allocated_storage
  storage_type                  = "gp3"
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.this.arn

  db_subnet_group_name                = aws_db_subnet_group.this.name
  parameter_group_name                = aws_db_parameter_group.this.name
  vpc_security_group_ids              = [aws_security_group.database.id]
  publicly_accessible                 = false
  multi_az                            = var.database_multi_az
  iam_database_authentication_enabled = true

  backup_retention_period         = var.database_backup_retention_days
  backup_window                   = "15:00-16:00"
  maintenance_window              = "sun:16:00-sun:17:00"
  copy_tags_to_snapshot           = true
  auto_minor_version_upgrade      = true
  deletion_protection             = var.database_deletion_protection
  skip_final_snapshot             = var.skip_final_database_snapshot
  final_snapshot_identifier       = var.skip_final_database_snapshot ? null : "${local.name}-final-${random_id.final_snapshot.hex}"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.this.arn
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  tags = { Name = "${local.name}-postgres" }
}
