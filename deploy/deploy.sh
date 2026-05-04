#!/usr/bin/env bash
# =============================================================================
# deploy.sh — SAP Business AI Pulse deployment script
# Target: Kyma on BTP (api.c-5a930ed.kyma.ondemand.com)
# Auth:   OIDC via kubectl-oidc_login — browser login will be triggered on
#         first run or when the token has expired. Requires kubelogin plugin:
#           brew install int128/kubelogin/kubelogin   (macOS)
#           kubectl krew install oidc-login            (cross-platform)
# Usage:  ./deploy/deploy.sh [--release <tag>] [--skip-build] [--dry-run]
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
RELEASE="${RELEASE:-2026.05.04.1552}"
IMAGE_NAME="sap-bizai-pulse"
REGISTRY="${REGISTRY:-}"                   # Set via env or --registry flag
NAMESPACE="${NAMESPACE:-sap-ai-pulse}"
KUBECONFIG_PATH="${KUBECONFIG:-$(dirname "$0")/../_cfg/kubeconfig.yaml}"
KUBE_CONTEXT="sap-ai-factory"
OIDC_ISSUER="https://kyma.accounts.ondemand.com"
SKIP_BUILD=false
DRY_RUN=false

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --release)    RELEASE="$2";  shift 2 ;;
    --registry)   REGISTRY="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --dry-run)    DRY_RUN=true;  shift ;;
    *) error "Unknown argument: $1" ;;
  esac
done

IMAGE_TAG="${REGISTRY:+${REGISTRY}/}${IMAGE_NAME}:${RELEASE}"

# ── Dry-run wrapper ───────────────────────────────────────────────────────────
run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} $*"
  else
    "$@"
  fi
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SAP Business AI Pulse — Deployment${NC}"
echo -e "${CYAN}  Release : ${RELEASE}${NC}"
echo -e "${CYAN}  Image   : ${IMAGE_TAG}${NC}"
echo -e "${CYAN}  Cluster : ${KUBE_CONTEXT}${NC}"
echo -e "${CYAN}  NS      : ${NAMESPACE}${NC}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}  Mode    : DRY RUN — no changes will be made${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
info "Running pre-flight checks..."

command -v docker         >/dev/null 2>&1 || error "docker is not installed or not in PATH"
command -v kubectl        >/dev/null 2>&1 || error "kubectl is not installed or not in PATH"
command -v kubectl-oidc_login >/dev/null 2>&1 \
  || command -v kubelogin >/dev/null 2>&1 \
  || error "kubelogin (kubectl-oidc_login) is required for SAP BTP OIDC auth.\n        Install: brew install int128/kubelogin/kubelogin  OR  kubectl krew install oidc-login"
[[ -f "$KUBECONFIG_PATH" ]]           || error "kubeconfig not found at: $KUBECONFIG_PATH"
[[ -n "$REGISTRY" ]]                  || error "REGISTRY is not set. Pass --registry <registry-url> or export REGISTRY=..."

export KUBECONFIG="$KUBECONFIG_PATH"
kubectl config use-context "$KUBE_CONTEXT" --kubeconfig="$KUBECONFIG_PATH" >/dev/null

# OIDC login — may open a browser tab for SAP BTP SSO on first run or token expiry
info "Authenticating with SAP BTP Kyma cluster (OIDC)..."
info "  Issuer  : ${OIDC_ISSUER}"
info "  Context : ${KUBE_CONTEXT}"
warn "  A browser window may open for SAP BTP login if your token has expired."
kubectl cluster-info --context "$KUBE_CONTEXT" >/dev/null 2>&1 \
  || error "Cannot reach Kyma cluster at ${KUBE_CONTEXT}. Complete the browser login and re-run, or check your VPN."

success "Pre-flight checks passed."

# ── Step 1: Build ─────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == "false" ]]; then
  info "Step 1/5 — Building Docker image: ${IMAGE_TAG}"
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  run docker build \
    --platform linux/amd64 \
    -t "${IMAGE_TAG}" \
    "${REPO_ROOT}"
  success "Image built: ${IMAGE_TAG}"
else
  warn "Step 1/5 — Skipping build (--skip-build)"
fi

# ── Step 2: Push ──────────────────────────────────────────────────────────────
info "Step 2/5 — Pushing image to registry..."
run docker push "${IMAGE_TAG}"
success "Image pushed: ${IMAGE_TAG}"

# ── Step 3: Ensure namespace ──────────────────────────────────────────────────
info "Step 3/5 — Ensuring namespace '${NAMESPACE}' exists..."
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  run kubectl create namespace "${NAMESPACE}"
  success "Namespace created: ${NAMESPACE}"
else
  success "Namespace exists: ${NAMESPACE}"
fi

# ── Step 4: Apply Kyma manifests ──────────────────────────────────────────────
info "Step 4/5 — Applying Kyma manifests..."
MANIFEST_DIR="$(dirname "$0")"

run kubectl apply -f "${MANIFEST_DIR}/kyma-secret.yaml"        --namespace="${NAMESPACE}"
run kubectl apply -f "${MANIFEST_DIR}/kyma-deployment.yaml"    --namespace="${NAMESPACE}"
run kubectl apply -f "${MANIFEST_DIR}/kyma-service.yaml"       --namespace="${NAMESPACE}"
run kubectl apply -f "${MANIFEST_DIR}/kyma-apirule.yaml"       --namespace="${NAMESPACE}"

# Stamp the exact image tag for this release
run kubectl set image deployment/sap-bizai-pulse \
  sap-bizai-pulse="${IMAGE_TAG}" \
  --namespace="${NAMESPACE}"

success "Manifests applied."

# ── Step 5: Rollout status ────────────────────────────────────────────────────
info "Step 5/5 — Waiting for rollout to complete..."
if [[ "$DRY_RUN" == "false" ]]; then
  kubectl rollout status deployment/sap-bizai-pulse \
    --namespace="${NAMESPACE}" \
    --timeout=180s
  success "Rollout complete."

  # ── Health check ──────────────────────────────────────────────────────────
  info "Running health check..."
  INGRESS_HOST=$(kubectl get apirule sap-bizai-pulse \
    --namespace="${NAMESPACE}" \
    -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
  if [[ -n "$INGRESS_HOST" ]]; then
    sleep 3
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${INGRESS_HOST}/health" || echo "000")
    if [[ "$HTTP_STATUS" == "200" ]]; then
      success "Health check passed: https://${INGRESS_HOST}/health"
    else
      warn "Health check returned HTTP ${HTTP_STATUS} — check pod logs if unexpected."
    fi
  fi
else
  warn "Skipping rollout wait and health check (dry-run)."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment complete — ${RELEASE}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
