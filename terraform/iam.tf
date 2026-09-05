data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid       = "RuntimeSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [local.database_secret_arn, var.runtime_secret_arn]
  }

  statement {
    sid       = "DecryptRuntimeSecrets"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = concat([aws_kms_key.this.arn], var.runtime_secret_kms_key_arns)
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "runtime-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

data "aws_iam_policy_document" "marketplace_license" {
  #checkov:skip=CKV_AWS_356:License Manager consumption APIs require Resource *; no infrastructure or IAM mutation is granted.
  statement {
    sid    = "AwsMarketplaceContainerLicense"
    effect = "Allow"
    actions = [
      "license-manager:CheckoutLicense",
      "license-manager:GetLicense",
      "license-manager:CheckInLicense",
      "license-manager:ExtendLicenseConsumption",
      "license-manager:ListReceivedLicenses",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "marketplace_license" {
  name   = "marketplace-license"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.marketplace_license.json
}
