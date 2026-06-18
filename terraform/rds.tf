resource "aws_db_subnet_group" "postgres" {
  name       = "${var.cluster_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private1.id, aws_subnet.private2.id]

  tags = {
    Name = "${var.cluster_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.cluster_name}-postgres"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  allocated_storage = 20
  db_name            = var.db_name
  username           = var.db_username
  password           = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.postgres.id
  vpc_security_group_ids = [aws_security_group.data_layer.id]

  # Private by design -- the app backend reaches this through the VPC,
  # it should never be reachable directly from the public internet.
  publicly_accessible = false

  multi_az                = false
  backup_retention_period = 7
  skip_final_snapshot     = true

  depends_on = [aws_db_subnet_group.postgres]

  tags = {
    Name = "${var.cluster_name}-postgres"
  }
}
