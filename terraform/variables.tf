variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "livestream-eks"
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS control plane and node group"
  type        = string
  default     = "1.30"
}

variable "node_instance_type" {
  description = "EC2 instance type for worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 4
}

variable "db_name" {
  description = "Name of the application database"
  type        = string
  default     = "livestream"
}

variable "db_username" {
  description = "Master username for RDS Postgres"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Master password for RDS Postgres. Pass via TF_VAR_db_password or a .tfvars file kept out of git -- never commit a real value here."
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type, used for the Socket.IO adapter shared across backend pods"
  type        = string
  default     = "cache.t3.micro"
}
