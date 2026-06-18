# ElastiCache Redis backs the Socket.IO Redis adapter (backend/src/server.js,
# backend/src/websocket/socketHandler.js). With more than one backend
# replica, this is what lets WebRTC signaling, chat, reactions, and viewer
# counts stay consistent no matter which pod a given socket lands on.

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.cluster_name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private1.id, aws_subnet.private2.id]
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id         = "${var.cluster_name}-redis"
  engine             = "redis"
  engine_version     = "7.1"
  node_type          = var.redis_node_type
  num_cache_nodes    = 1
  port               = 6379
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.data_layer.id]

  tags = {
    Name = "${var.cluster_name}-redis"
  }
}
