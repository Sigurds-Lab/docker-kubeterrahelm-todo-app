# Helm provider
provider "helm" {
  kubernetes {
    host                   = aws_eks_cluster.main.endpoint
    cluster_ca_certificate = base64decode(aws_eks_cluster.main.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.main.token
  }
}

# Deploy WordPress Helm chart
resource "helm_release" "wordpress" {
  name            = "wordpress-jamf"
  chart           = "${path.module}/../helm/wordpress-jamf"
  namespace       = "wordpress-jamf-test"
  create_namespace = true

  values = [
    file("${path.module}/helm-values.yaml")
  ]

  depends_on = [aws_eks_node_group.main]
}

# Wait for WordPress to be ready
resource "null_resource" "wait_for_wordpress" {
  provisioner "local-exec" {
    command = "kubectl rollout status deployment/wordpress -n wordpress-jamf-test --timeout=10m"
    environment = {
      KUBECONFIG = ""
    }
  }

  depends_on = [helm_release.wordpress]
}
