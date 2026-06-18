output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority" {
  value     = aws_eks_cluster.main.certificate_authority[0].data
  sensitive = true
}

output "rds_endpoint" {
  description = "Postgres endpoint (host:port). Use just the host part for DB_HOST."
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint. Use as REDIS_HOST for the backend's Socket.IO adapter."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = [aws_subnet.private1.id, aws_subnet.private2.id]
}

output "public_subnet_ids" {
  value = [aws_subnet.public1.id, aws_subnet.public2.id]
}
