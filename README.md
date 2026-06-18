# LiveStream — Browser-based Streaming Platform

Live streaming from the browser with camera, screen share, chat, emoji
reactions, polls, and a follow system. No OBS required.

## Architecture & Workflow

```
Developer (VS Code)
        |
        | terraform apply  -->  AWS (EKS + RDS Postgres + ElastiCache Redis)
        |
        | git push main    -->  GitHub Actions
                                  |-- Build backend Docker image --> ECR
                                  |-- Build frontend Docker image --> ECR
                                  |-- Commit new image tag to k8s/*.yaml
                                          |
                                        ArgoCD (watching this repo)
                                          |-- Detects manifest change
                                          |-- Syncs cluster automatically
```

```
Browser (viewer / broadcaster)
        |
        | HTTPS  -->  Ingress-Nginx (Load Balancer)
                        |-- /          --> frontend pods (x2)
                        |-- /api       --> backend pods (x2)
                        |-- /socket.io --> backend pods (x2)
                        |-- /hls       --> streaming pod (optional, OBS only)

Backend pods share state via:
  - RDS Postgres  (users, streams, chat, polls, follows)
  - ElastiCache Redis  (Socket.IO adapter -- WebRTC signaling,
                        viewer counts, chat, reactions across pods)
```

---

## Prerequisites

- AWS account with IAM permissions for EKS, EC2, RDS, ElastiCache, VPC, ECR
- VS Code with the **HashiCorp Terraform** extension installed
- Tools installed locally (Windows: use WSL2 or Git Bash):
  - `terraform` >= 1.6
  - `aws` CLI v2
  - `kubectl`
  - `docker`
  - `git`

---

## Part 1 — Local Tools Setup

### Step 1: Install AWS CLI

```bash
# Linux / WSL2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# macOS
brew install awscli

# Verify
aws --version
```

### Step 2: Configure AWS credentials

```bash
aws configure
# Enter:
#   AWS Access Key ID:     <your key>
#   AWS Secret Access Key: <your secret>
#   Default region:        us-east-1
#   Default output format: json
```

### Step 3: Install kubectl

```bash
# Linux / WSL2
curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# macOS
brew install kubectl

# Verify
kubectl version --client
```

### Step 4: Install Terraform

```bash
# Linux / WSL2
sudo apt-get update && sudo apt-get install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt-get install terraform

# macOS
brew tap hashicorp/tap && brew install hashicorp/tap/terraform

# Verify
terraform -version
```

### Step 5: Install Docker

```bash
# Linux / WSL2
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
newgrp docker

# macOS
brew install --cask docker

# Verify
docker --version
```

---

## Part 2 — AWS: Create ECR Repositories

You need two ECR repositories to store your Docker images before the CI
pipeline can push to them.

### Step 6: Create ECR repos

```bash
aws ecr create-repository --repository-name livestream-backend --region us-east-1
aws ecr create-repository --repository-name livestream-frontend --region us-east-1
```

Note the repository URIs printed in the output — you will need them later.
They look like:
```
123456789012.dkr.ecr.us-east-1.amazonaws.com/livestream-backend
123456789012.dkr.ecr.us-east-1.amazonaws.com/livestream-frontend
```

---

## Part 3 — Terraform: Provision AWS Infrastructure

Open the project in VS Code. All Terraform files are in the `terraform/`
folder.

### Step 7: Open the project in VS Code and review terraform files

Open VS Code, open the `terraform/` folder. The files are:

| File | What it creates |
|------|----------------|
| `variables.tf` | All configurable inputs |
| `main.tf` | VPC, subnets, NAT gateway, security groups, EKS cluster + node group, IAM roles, addons |
| `rds.tf` | RDS Postgres (private subnets, not public-facing) |
| `redis.tf` | ElastiCache Redis (for Socket.IO cross-pod signaling) |
| `outputs.tf` | Prints cluster name, RDS endpoint, Redis endpoint after apply |

### Step 8: Initialize and apply Terraform

Open a terminal in VS Code (`Ctrl+`` ` ``) and run:

```bash
cd terraform
terraform init
terraform plan -var="db_password=YourStrongPasswordHere"
terraform apply -var="db_password=YourStrongPasswordHere"
```

> Type `yes` when prompted. This takes about 15 minutes to complete (EKS
> control plane creation is the slow part).

### Step 9: Save the Terraform outputs

When `apply` finishes, you will see outputs like:

```
cluster_name    = "livestream-eks"
cluster_endpoint = "https://XXXX.gr7.us-east-1.eks.amazonaws.com"
rds_endpoint    = "livestream-eks-postgres.xxxx.us-east-1.rds.amazonaws.com:5432"
redis_endpoint  = "livestream-eks-redis.xxxx.cache.amazonaws.com"
```

**Save these values** — you will need `rds_endpoint` and `redis_endpoint`
in Step 14.

---

## Part 4 — Connect kubectl to Your Cluster

You do NOT need a bastion EC2 instance. The EKS API endpoint is publicly
accessible (the worker nodes themselves sit in private subnets, but the
control plane API can be reached from your laptop). All `kubectl` commands
run from your own machine.

### Step 10: Update kubeconfig

```bash
aws eks update-kubeconfig --region us-east-1 --name livestream-eks
```

### Step 11: Verify cluster connectivity

```bash
kubectl get nodes
```

You should see 2 worker nodes in `Ready` state:

```
NAME                          STATUS   ROLES    AGE   VERSION
ip-10-0-3-xxx.ec2.internal    Ready    <none>   2m    v1.30.x
ip-10-0-4-xxx.ec2.internal    Ready    <none>   2m    v1.30.x
```

---

## Part 5 — Install Ingress-Nginx and ArgoCD

### Step 12: Install Ingress-Nginx

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Wait for the controller pod to be Running
kubectl get pods -n ingress-nginx
```

Wait until the `ingress-nginx-controller` pod shows `Running`, then get
the Load Balancer URL:

```bash
kubectl get svc -n ingress-nginx
```

Note the `EXTERNAL-IP` — this is your app's public URL once everything is
deployed.

### Step 13: Install ArgoCD

```bash
kubectl create namespace argocd

kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Expose ArgoCD UI via LoadBalancer
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'

# Wait a minute then get the ArgoCD UI URL
kubectl get svc -n argocd
```

Get the initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo
```

Open the ArgoCD `EXTERNAL-IP` in your browser, log in with:
- Username: `admin`
- Password: the value printed above

---

## Part 6 — Configure the Code

Now you need to fill in real values in two places before deploying.

### Step 14: Update k8s/secrets.yaml

Open `k8s/secrets.yaml` in VS Code and replace the placeholder values:

```yaml
# ConfigMap section — replace these two lines:
  DB_HOST: "REPLACE_WITH_RDS_ENDPOINT"      # <-- paste rds_endpoint from Step 9
                                              #     (without the :5432 port suffix)
  REDIS_HOST: "REPLACE_WITH_ELASTICACHE_ENDPOINT"  # <-- paste redis_endpoint from Step 9

# Secret section — replace these two lines:
  DB_PASSWORD: "REPLACE_ME"                  # <-- same password you used in terraform apply
  JWT_SECRET: "REPLACE_ME_WITH_A_LONG_RANDOM_STRING"  # <-- any long random string,
                                              #     e.g. run: openssl rand -hex 32
```

**Do not commit this file after filling in real values.** Apply it manually:

```bash
kubectl apply -f k8s/secrets.yaml
```

### Step 15: Update k8s-argocd/app.yaml

Open `k8s-argocd/app.yaml` and replace:

```yaml
  source:
    repoURL: https://github.com/REPLACE_WITH_YOUR_USERNAME/streaming-application.git
```

with your actual GitHub repo URL.

### Step 16: Update k8s/backend-deploy.yaml and k8s/frontend-deploy.yaml

The GitHub Actions CI workflow (`Step 18`) will update the image lines
automatically on every push. But to do a first manual deploy before CI
runs, you can set the image yourself. Replace the `image:` line in each
file:

**k8s/backend-deploy.yaml:**
```yaml
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/livestream-backend:latest
```

**k8s/frontend-deploy.yaml:**
```yaml
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/livestream-frontend:latest
```

Use your actual ECR repo URI from Step 6.

---

## Part 7 — Load the Database Schema

The RDS instance was just created with an empty database. You need to load
the schema once.

### Step 17: Load the database schema

Install the Postgres client if you don't have it:

```bash
# Linux / WSL2
sudo apt-get install -y postgresql-client

# macOS
brew install postgresql
```

Load the schema (use the RDS endpoint from Step 9, without the `:5432`):

```bash
psql -h YOUR_RDS_ENDPOINT \
     -U postgres \
     -d livestream \
     -f database/init.sql
# Enter your db_password when prompted
```

---

## Part 8 — GitHub Secrets and CI/CD

The GitHub Actions workflow builds your Docker images and updates the
Kubernetes manifests automatically on every push to `main`. ArgoCD then
picks up the manifest changes and syncs the cluster.

### Step 18: Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**. Add each of these:

| Secret name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `AWS_REGION` | `us-east-1` |
| `ECR_BACKEND_REPO` | `livestream-backend` |
| `ECR_FRONTEND_REPO` | `livestream-frontend` |
| `VITE_API_URL` | `http://YOUR_INGRESS_LB_URL/api` (from Step 12) |
| `VITE_SOCKET_URL` | `http://YOUR_INGRESS_LB_URL` (from Step 12) |

---

## Part 9 — Push to GitHub and Let ArgoCD Deploy

### Step 19: Push your code

```bash
git add .
git commit -m "initial deploy"
git push origin main
```

This triggers the GitHub Actions workflow which:
1. Builds the backend Docker image and pushes it to ECR
2. Builds the frontend Docker image (with your API URL baked in) and pushes to ECR
3. Updates the `image:` lines in `k8s/backend-deploy.yaml` and
   `k8s/frontend-deploy.yaml` with the new image tag
4. Commits and pushes the updated manifests back to `main`

### Step 20: Register the app with ArgoCD

```bash
kubectl apply -f k8s-argocd/app.yaml
```

ArgoCD now watches your repo. When it sees the manifest update from Step 19,
it automatically applies all files in `k8s/` to the cluster.

### Step 21: Verify deployment

```bash
# Check all pods are Running
kubectl get pods -n livestream

# Check services
kubectl get svc -n livestream

# Check ingress
kubectl get ingress -n livestream
```

You should see:

```
NAME                     READY   STATUS    RESTARTS
backend-deployment-xxx   1/1     Running   0
backend-deployment-xxx   1/1     Running   0
frontend-deployment-xxx  1/1     Running   0
frontend-deployment-xxx  1/1     Running   0
```

### Step 22: Access the application

Get the Load Balancer URL:

```bash
kubectl get svc -n ingress-nginx
```

Open the `EXTERNAL-IP` in your browser. You should see the LiveStream
landing page.

---

## Part 10 — Monitor ArgoCD

Open the ArgoCD UI (from Step 13) and you will see the `livestream`
application. Every time you push to `main`:
- GitHub Actions builds new images and commits updated manifests
- ArgoCD detects the commit and shows `OutOfSync`
- ArgoCD syncs automatically (within ~3 minutes) and shows `Healthy`

To force a manual sync from the ArgoCD UI: click the app → **Sync** →
**Synchronize**.

---

## What Each Future Push Does

```
You make a code change and push to main
        |
        v
GitHub Actions (.github/workflows/ci-cd.yml)
  [build-and-push job]
    1. Builds backend Docker image
    2. Builds frontend Docker image  
    3. Pushes both to ECR with tag = first 7 chars of commit SHA
  [update-manifests job]
    4. Updates image: line in k8s/backend-deploy.yaml
    5. Updates image: line in k8s/frontend-deploy.yaml
    6. git commit + git push
        |
        v
ArgoCD detects the new commit in k8s/*.yaml
  7. Pulls updated manifests
  8. Applies to EKS cluster (rolling update, zero downtime)
```

---

## Summary of Key Components

| Component | Purpose |
|-----------|---------|
| **EKS** | Managed Kubernetes — runs backend (x2) and frontend (x2) pods |
| **RDS Postgres** | Persistent storage — users, streams, chat, polls, follows |
| **ElastiCache Redis** | Shared Socket.IO state — WebRTC signaling, viewer counts, chat across pods |
| **ECR** | Docker image registry |
| **Ingress-Nginx** | Routes HTTPS traffic to backend/frontend, handles WebSocket upgrades |
| **ArgoCD** | CD — watches this repo, syncs cluster when manifests change |
| **GitHub Actions** | CI — builds images, pushes to ECR, commits new image tags |

---

## Troubleshooting

**Pods stuck in `ImagePullBackOff`**
```bash
kubectl describe pod <pod-name> -n livestream
# Check: does the image URI in the deploy YAML match your ECR repo?
# Check: do the worker nodes have ECR pull permission? (AmazonEC2ContainerRegistryReadOnly is attached in Terraform)
```

**Backend pods crashing on startup**
```bash
kubectl logs <backend-pod-name> -n livestream
# Most common causes:
# - DB_HOST wrong (check k8s/secrets.yaml ConfigMap)
# - DB_PASSWORD wrong (check k8s/secrets.yaml Secret)
# - RDS security group not allowing connections from EKS nodes
#   (Terraform sets this up automatically -- verify aws_security_group.data_layer in terraform/main.tf)
```

**WebRTC video not connecting (viewers see blank)**
```bash
# Most likely: frontend was built with the wrong VITE_API_URL / VITE_SOCKET_URL
# Check the GitHub secrets match the actual ingress EXTERNAL-IP
# Re-run the workflow after correcting them (push an empty commit):
git commit --allow-empty -m "fix: rebuild with correct API URLs"
git push
```

**ArgoCD shows OutOfSync but won't sync**
```bash
kubectl get events -n livestream
# Then force sync from ArgoCD UI or:
kubectl rollout restart deployment/backend-deployment -n livestream
kubectl rollout restart deployment/frontend-deployment -n livestream
```

**Chat/reactions not working across replicas**
```bash
kubectl logs <backend-pod-name> -n livestream | grep -i redis
# Should see: "Socket.IO Redis adapter connected (redis://...)"
# If not: check REDIS_HOST in k8s/secrets.yaml ConfigMap matches ElastiCache endpoint
```

---

## Clean Up (Destroy Everything)

```bash
# Remove ArgoCD app first so it doesn't fight Terraform
kubectl delete -f k8s-argocd/app.yaml

# Remove all app resources
kubectl delete namespace livestream

# Destroy all AWS infrastructure
cd terraform
terraform destroy -var="db_password=YourStrongPasswordHere"
```

> Type `yes` when prompted. This deletes the EKS cluster, RDS, ElastiCache,
> VPC, and all associated resources. ECR repositories are not deleted by
> Terraform (they need manual deletion from the AWS console or CLI to avoid
> accidental image loss).

---

**Last Updated:** June 2026
