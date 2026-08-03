# CI/CD and GitOps for ML — Registries, Versioning, Automated Rollouts

## The ML-specific CI/CD pipeline shape

```
Code/model change → CI: build image, run tests, tag with version →
push to registry → CD: update the manifest's image tag → cluster syncs to match →
rolling update deploys the new version → automated rollback if health checks fail
```

The key difference from typical application CI/CD: **the "artifact" often includes
a trained model**, not just code, and validating that artifact (accuracy hasn't
regressed, the model actually loads correctly) belongs in the pipeline alongside
normal software tests.

## Image tagging and versioning strategy

```bash
# Bad: relying on `latest` — no way to know what's actually running, no clean rollback target
docker build -t myregistry.io/model-api:latest .

# Good: immutable, meaningful tags
docker build -t myregistry.io/model-api:v1.2.0 .
docker build -t myregistry.io/model-api:$(git rev-parse --short HEAD) .
```

**Never deploy `:latest` to production.** Use immutable version tags (semantic
version, git SHA, or both) so that any running Deployment's exact image is
unambiguous, reproducible, and trivially rollback-able —
`kubectl rollout undo` only works meaningfully if each rollout was to a distinct,
identifiable tag.

## A GitHub Actions CI pipeline for an ML service

```yaml
name: build-and-push
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: pytest tests/

      - name: Validate model loads correctly
        run: python scripts/validate_model.py --model artifacts/model.joblib

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: |
            myregistry.io/model-api:${{ github.sha }}
            myregistry.io/model-api:latest
```

```python
# scripts/validate_model.py — a genuinely ML-specific CI step
import joblib
import sys

def validate(model_path):
    model = joblib.load(model_path)          # fails loudly if serialization/version mismatch
    sample_input = load_sample_input()
    prediction = model.predict(sample_input)  # sanity-check inference actually runs
    assert prediction is not None, "Model produced no output"
    print("Model validation passed")

if __name__ == "__main__":
    validate(sys.argv[1])
```

**Add a model-loading/sanity-inference step to CI**, not just standard code
tests — this catches the "pickled with a different library version" class of
failure (see `dockerfiles_for_ml.md`) *before* it reaches a running cluster,
rather than discovering it via a crash-looping pod in production.

## GitOps — Argo CD for declarative, auditable deployment

**GitOps** treats a Git repository (not a CI pipeline directly, and not manual
`kubectl apply`) as the single source of truth for what should be running in the
cluster — a controller (Argo CD is the standard choice) continuously reconciles the
live cluster state to match what's declared in Git.

```yaml
# Argo CD Application manifest — points at a Git repo containing your K8s manifests
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: model-api
spec:
  source:
    repoURL: https://github.com/myorg/model-api-manifests
    targetRevision: main
    path: k8s/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true    # automatically reverts manual out-of-band cluster changes
```

The CI pipeline's job becomes: build, test, push the image, then **update the
image tag in the manifests repo** (often via an automated commit) — Argo CD picks
up that Git change and handles the actual cluster rollout. This separation (CI
builds artifacts, CD/GitOps syncs cluster state from Git) gives a full audit trail
of every production change as Git history, and `selfHeal` means any manual,
undocumented cluster change gets automatically reverted back to what's declared in
Git — preventing configuration drift.

## Rollback strategy

```bash
# Kubernetes-native rollback (works regardless of GitOps)
kubectl rollout undo deployment/model-api

# GitOps rollback — revert the Git commit, let Argo CD sync the reversion
git revert <commit-sha>
git push
```

With GitOps, **rolling back is a `git revert`**, not a manual cluster operation —
the same audit trail and review process that applies to any other code change
applies equally to production rollbacks, a meaningful reliability and
accountability improvement over ad-hoc `kubectl` commands run directly against a
cluster.

## Automated rollback on failed health checks

Combine Kubernetes' native rolling-update safety (a rollout with failing readiness
probes on new Pods won't fully replace the old ReplicaSet, since
`maxUnavailable`/`maxSurge` are respected against Pod readiness) with monitoring
alerts (see `monitoring_and_drift.md`) that can trigger an automatic
`kubectl rollout undo` or Argo CD sync-to-previous-revision if key metrics
(error rate, latency, model prediction distribution) regress after a deploy —
rather than relying purely on manual observation to catch a bad rollout.

## Practical guidance

1. **Never deploy `:latest`** — use immutable, meaningful version tags for every
   image.
2. **Add model-loading/sanity-inference validation to CI**, not just code tests —
   this is the ML-specific addition to an otherwise standard pipeline.
3. **Adopt GitOps (Argo CD or equivalent) once you have more than a couple of
   people deploying to a cluster** — the audit trail and drift-prevention benefits
   compound with team size.
4. **Treat rollback as `git revert`, not a manual cluster operation**, once
   GitOps is in place.
5. **Wire monitoring alerts to trigger (or at least prompt) automated rollback**
   rather than relying solely on someone noticing a regression manually.