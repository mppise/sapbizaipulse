#!/usr/bin/env bash
# =============================================================================
# SAP Business AI Pulse — Deployment Script
# Target: Kyma on BTP (api.c-5a930ed.kyma.ondemand.com)
# Auth:   OIDC via kubectl-oidc_login — browser login will be triggered on
#         first run or when the token has expired. Requires kubelogin plugin:
#           brew install int128/kubelogin/kubelogin   (macOS)
#           kubectl krew install oidc-login            (cross-platform)
#
# Usage:
#   ./deploy/go.sh --env test                        # Build, run locally on port 8080
#   ./deploy/go.sh --env prod                        # Build, push to registry, deploy on Kyma
#   ./deploy/go.sh --env prod --tag 2026.05.04.1552  # Override image tag
#
# Prerequisites (prod):
#   - docker           (image build + push)
#   - kubectl          (Kyma cluster access; KUBECONFIG auto-set to _cfg/kubeconfig.yaml)
#   - kubectl-oidc_login / kubelogin  (SAP BTP OIDC authentication)
#   - docker logged in to target registry ($REGISTRY)
#
# Prerequisites (test):
#   - docker           (image build + run)
#   - _cfg/.env        (credentials loaded as container env vars)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# --- Defaults ----------------------------------------------------------------

ENV=""
IMAGE_TAG="2026.05.04.1552"
REGISTRY="${REGISTRY:-docker.io/mppise}"
NAMESPACE="${NAMESPACE:-default}"
DEPLOYMENT_NAME="sap-bizai-pulse"
CONTAINER_PORT=8080
LOCAL_PORT=8080
ENV_FILE="${PROJECT_ROOT}/_cfg/.env"
KUBECONFIG="${KUBECONFIG:-${PROJECT_ROOT}/_cfg/kubeconfig.yaml}"
KUBE_CONTEXT="sap-ai-factory"
OIDC_ISSUER="https://kyma.accounts.ondemand.com"
export KUBECONFIG

# --- Logging -----------------------------------------------------------------

log()  { echo "[$(date -u +%H:%M:%S)] $*"; }
ok()   { echo "[$(date -u +%H:%M:%S)] ✔ $*"; }
fail() { echo "[$(date -u +%H:%M:%S)] ✘ $*" >&2; exit 1; }

# --- Argument parsing --------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV="$2";       shift 2 ;;
    --tag) IMAGE_TAG="$2"; shift 2 ;;
    *)     fail "Unknown argument: $1" ;;
  esac
done

[[ -z "$ENV" ]] && fail "Usage: $0 --env [test|prod] [--tag <tag>]"
[[ "$ENV" != "test" && "$ENV" != "prod" ]] && fail "--env must be 'test' or 'prod'"

IMAGE_FULL="${REGISTRY:+${REGISTRY}/}${DEPLOYMENT_NAME}:${IMAGE_TAG}"

log "=== SAP Business AI Pulse — Deployment Script ==="
log "Environment : $ENV"
log "Image       : $IMAGE_FULL"
echo ""

# =============================================================================
# STAGE 1 — Environment readiness checks
# =============================================================================

log "--- Stage 1: Environment readiness checks ---"

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker and retry."
fi
ok "Docker daemon is running"

if [[ "$ENV" == "prod" ]]; then
  command -v kubectl >/dev/null 2>&1 || fail "kubectl is not installed or not in PATH"
  ok "kubectl is available"

  command -v kubectl-oidc_login >/dev/null 2>&1 \
    || command -v kubelogin >/dev/null 2>&1 \
    || fail "kubelogin (kubectl-oidc_login) is required for SAP BTP OIDC auth. Install: brew install int128/kubelogin/kubelogin  OR  kubectl krew install oidc-login"
  ok "kubelogin plugin is available"

  [[ -f "$KUBECONFIG" ]] || fail "kubeconfig not found at: $KUBECONFIG"
  kubectl config use-context "$KUBE_CONTEXT" >/dev/null

  log "Authenticating with SAP BTP Kyma cluster (OIDC)..."
  log "  Issuer  : ${OIDC_ISSUER}"
  log "  Context : ${KUBE_CONTEXT}"
  log "  Note    : A browser window may open for SAP BTP login if your token has expired."
  kubectl cluster-info >/dev/null 2>&1 \
    || fail "Cannot reach Kyma cluster. Complete the browser login and re-run, or check your VPN."
  ok "Kubernetes cluster is reachable"

  if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    log "Namespace '$NAMESPACE' not found — creating..."
    kubectl create namespace "$NAMESPACE"
    ok "Namespace '$NAMESPACE' created"
  else
    ok "Namespace '$NAMESPACE' exists"
  fi

  # Always apply secret to keep cluster in sync with _cfg/.env
  log "Applying secret 'sap-bizai-pulse-secret' from _cfg/.env ..."
  kubectl delete secret sap-bizai-pulse-secret -n "$NAMESPACE" >/dev/null 2>&1 || true
  kubectl create secret generic sap-bizai-pulse-secret \
    --from-env-file="${PROJECT_ROOT}/_cfg/.env" \
    -n "$NAMESPACE"
  ok "Secret 'sap-bizai-pulse-secret' applied"
fi

if [[ "$ENV" == "test" ]]; then
  [[ -f "$ENV_FILE" ]] || fail "_cfg/.env not found at $ENV_FILE. Required for test environment."
  ok "_cfg/.env present for test run"
fi

echo ""

# =============================================================================
# STAGE 2 — Build
# =============================================================================

log "--- Stage 2: Docker image build ---"

docker build \
  --platform linux/amd64 \
  --tag "$IMAGE_FULL" \
  --label "release=$IMAGE_TAG" \
  --label "build-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$PROJECT_ROOT" 2>&1 | while IFS= read -r line; do log "  [docker] $line"; done

ok "Image built: $IMAGE_FULL"
echo ""

# =============================================================================
# STAGE 3 (test) — Run container locally
# =============================================================================

if [[ "$ENV" == "test" ]]; then
  log "--- Stage 3 (test): Running container locally ---"

  # Stop any existing test container
  docker rm -f "${DEPLOYMENT_NAME}-test" >/dev/null 2>&1 || true

  docker run -d \
    --name "${DEPLOYMENT_NAME}-test" \
    --rm \
    -p "${LOCAL_PORT}:${CONTAINER_PORT}" \
    --env-file "$ENV_FILE" \
    -e PORT="${CONTAINER_PORT}" \
    -e NODE_ENV="production" \
    "$IMAGE_FULL" >/dev/null

  log "Container started. Waiting for server on http://localhost:${LOCAL_PORT}/health ..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${LOCAL_PORT}/health" >/dev/null 2>&1; then
      ok "Server is responding on http://localhost:${LOCAL_PORT}/health"
      break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
      docker stop "${DEPLOYMENT_NAME}-test" 2>/dev/null || true
      fail "Server did not start within 30 seconds. Check: docker logs ${DEPLOYMENT_NAME}-test"
    fi
  done

  echo ""
  log "==================================================================="
  log "  SAP Business AI Pulse ${IMAGE_TAG} is running in TEST mode."
  log "  Open: http://localhost:${LOCAL_PORT}"
  log ""
  log "  To stop: docker stop ${DEPLOYMENT_NAME}-test"
  log "==================================================================="
  exit 0
fi

# =============================================================================
# STAGE 3 (prod) — Push image to registry
# =============================================================================

log "--- Stage 3 (prod): Pushing image to registry ---"

docker push "$IMAGE_FULL" 2>&1 | while IFS= read -r line; do log "  [push] $line"; done
ok "Image pushed: $IMAGE_FULL"
echo ""

# =============================================================================
# STAGE 4 (prod) — Deploy on Kyma
# =============================================================================

log "--- Stage 4 (prod): Deploying to Kyma namespace '$NAMESPACE' ---"

if kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" >/dev/null 2>&1; then
  log "Deployment '$DEPLOYMENT_NAME' exists — rolling image update..."
  kubectl set image "deployment/${DEPLOYMENT_NAME}" \
    "${DEPLOYMENT_NAME}=${IMAGE_FULL}" \
    -n "$NAMESPACE"
  ok "Image updated to $IMAGE_FULL"
else
  log "Deployment '$DEPLOYMENT_NAME' does not exist — applying all manifests..."
  for f in "${SCRIPT_DIR}"/kyma-deployment.yaml \
            "${SCRIPT_DIR}"/kyma-service.yaml \
            "${SCRIPT_DIR}"/kyma-apirule.yaml; do
    kubectl apply -f "$f" -n "$NAMESPACE"
    log "  Applied: $(basename "$f")"
  done
  kubectl set image "deployment/${DEPLOYMENT_NAME}" \
    "${DEPLOYMENT_NAME}=${IMAGE_FULL}" \
    -n "$NAMESPACE"
  ok "All manifests applied; image set to $IMAGE_FULL"
fi

log "Waiting for rollout to complete..."
kubectl rollout status "deployment/${DEPLOYMENT_NAME}" -n "$NAMESPACE" --timeout=180s
ok "Rollout complete"
echo ""

# =============================================================================
# STAGE 5 (prod) — Health check
# =============================================================================

log "--- Stage 5 (prod): Health check ---"

INGRESS_HOST=$(kubectl get apirule "$DEPLOYMENT_NAME" \
  -n "$NAMESPACE" \
  -o jsonpath='{.spec.host}' 2>/dev/null || echo "")

if [[ -n "$INGRESS_HOST" ]]; then
  sleep 3
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${INGRESS_HOST}/health" || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    ok "Health check passed: https://${INGRESS_HOST}/health"
  else
    log "⚠  Health check returned HTTP ${HTTP_STATUS} — check pod logs if unexpected."
  fi
else
  log "⚠  Could not determine ingress host from APIRule — skipping health check."
fi

echo ""
log "==================================================================="
log "  SAP Business AI Pulse ${IMAGE_TAG} deployed to '${NAMESPACE}'."
log ""
log "  Next steps:"
log "  1. Run migrate.sql on HANA Cloud if this is a first-time or schema-change deploy"
log "  2. Smoke test: fetch → approve → suggest topics → generate → publish → view newsletter"
log "  3. Verify /health returns {\"status\":\"ok\"}"
log "  4. Check APIRule host: kubectl get apirule ${DEPLOYMENT_NAME} -n ${NAMESPACE}"
log "==================================================================="
