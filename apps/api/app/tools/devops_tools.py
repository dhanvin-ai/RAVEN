"""
DevOps & Cloud Site Reliability Engineering (SRE) Tools

Provides mock implementations for infrastructure management:
- Service health & metric inspection
- Kubernetes deployment autoscaling
- Rolling service restarts
- Deployment rollbacks with safeguard against critical database services
"""

from typing import Any, Dict

MOCK_SERVICES = {
    "auth-service": {
        "service": "auth-service",
        "env": "production",
        "status": "HEALTHY",
        "cpu_percent": 34.2,
        "memory_percent": 48.0,
        "replicas": 4,
        "current_version": "v2.14.0",
        "error_rate_percent": 0.02,
    },
    "payment-gateway": {
        "service": "payment-gateway",
        "env": "production",
        "status": "DEGRADED",
        "cpu_percent": 88.7,
        "memory_percent": 91.5,
        "replicas": 6,
        "current_version": "v1.8.2",
        "error_rate_percent": 4.15,
    },
    "postgres-master": {
        "service": "postgres-master",
        "env": "production",
        "status": "HEALTHY",
        "cpu_percent": 42.1,
        "memory_percent": 70.0,
        "replicas": 1,
        "current_version": "pg-16.1",
        "is_database": True,
    },
}

PROTECTED_INFRASTRUCTURE = {"postgres-master", "redis-cluster", "kafka-broker"}


def get_service_health(
    service_name: str = "",
    environment: str = "production",
    **kwargs
) -> Dict[str, Any]:
    """Retrieve operational telemetry, CPU/memory usage, and replica counts."""
    name = service_name or kwargs.get("service") or kwargs.get("name") or ""
    env = environment or kwargs.get("env", "production")
    clean_name = str(name).strip().lower()
    svc = MOCK_SERVICES.get(clean_name)
    if not svc:
        return {
            "success": False,
            "error": f"Service '{name}' not found in cluster namespace ({env})."
        }

    return {
        "success": True,
        "service_name": svc["service"],
        "environment": env,
        "status": svc["status"],
        "cpu_utilization": f"{svc['cpu_percent']}%",
        "memory_utilization": f"{svc['memory_percent']}%",
        "replicas_running": svc["replicas"],
        "version": svc["current_version"],
        "error_rate": f"{svc.get('error_rate_percent', 0.0)}%",
    }


def scale_deployment(
    service_name: str = "",
    replicas: int = 1,
    environment: str = "production",
    **kwargs
) -> Dict[str, Any]:
    """Scale the number of replica pods for a deployment."""
    name = service_name or kwargs.get("service") or kwargs.get("deployment") or kwargs.get("deployment_name") or ""
    rep_raw = replicas if replicas != 1 else kwargs.get("count", kwargs.get("replica_count", kwargs.get("replicas", 1)))
    try:
        rep = int(rep_raw)
    except (ValueError, TypeError):
        rep = 1

    clean_name = str(name).strip().lower()
    svc = MOCK_SERVICES.get(clean_name)
    if not svc:
        return {
            "success": False,
            "error": f"Deployment '{name}' not found."
        }

    if svc.get("is_database"):
        return {
            "success": False,
            "error": f"SCALE_REJECTED: '{name}' is a stateful database cluster and cannot be horizontally scaled via stateless pod scaling."
        }

    if rep > 50:
        return {
            "success": False,
            "error": f"POLICY_VIOLATION: Requested replica count ({rep}) exceeds cluster quota limit of 50 pods. SRE Tech Lead approval required."
        }

    if rep < 1:
        return {
            "success": False,
            "error": "Cannot scale service to 0 replicas in production (causes service outage)."
        }

    old_replicas = svc["replicas"]
    svc["replicas"] = rep

    return {
        "success": True,
        "service_name": clean_name,
        "environment": environment or kwargs.get("env", "production"),
        "previous_replicas": old_replicas,
        "new_replicas": rep,
        "status": "SCALING_APPLIED",
        "message": f"Deployment {clean_name} scaled from {old_replicas} to {rep} pods."
    }


def restart_service(
    service_name: str = "",
    environment: str = "production",
    reason: str = "Operational maintenance",
    **kwargs
) -> Dict[str, Any]:
    """Trigger a rolling restart of all container pods in a deployment."""
    name = service_name or kwargs.get("service") or kwargs.get("name") or ""
    clean_name = str(name).strip().lower()

    if clean_name in PROTECTED_INFRASTRUCTURE:
        return {
            "success": False,
            "error": f"DESTRUCTIVE_ACTION_BLOCKED: Restarting critical database component '{name}' in production requires active Change Advisory Board (CAB) ticket and database administrator lock."
        }

    svc = MOCK_SERVICES.get(clean_name)
    if not svc:
        return {
            "success": False,
            "error": f"Service '{name}' not found."
        }

    svc["status"] = "RESTARTING_ROLLING"

    return {
        "success": True,
        "service_name": clean_name,
        "environment": environment or kwargs.get("env", "production"),
        "reason": reason or kwargs.get("msg", "Operational maintenance"),
        "status": "ROLLING_RESTART_TRIGGERED",
        "message": f"Rolling restart initiated for {clean_name} in {environment}. Zero-downtime policy active."
    }


def rollback_release(
    service_name: str = "",
    target_version: str = "",
    environment: str = "production",
    **kwargs
) -> Dict[str, Any]:
    """Roll back deployment to a previous stable container image."""
    name = service_name or kwargs.get("service") or kwargs.get("name") or ""
    ver = target_version or kwargs.get("version") or kwargs.get("image_tag") or kwargs.get("target") or "v1.0.0"
    clean_name = str(name).strip().lower()
    svc = MOCK_SERVICES.get(clean_name)
    if not svc:
        return {
            "success": False,
            "error": f"Service '{name}' not found."
        }

    old_version = svc["current_version"]
    svc["current_version"] = str(ver)
    svc["status"] = "HEALTHY"

    return {
        "success": True,
        "service_name": clean_name,
        "environment": environment or kwargs.get("env", "production"),
        "previous_version": old_version,
        "rolled_back_to": str(ver),
        "status": "ROLLBACK_SUCCESSFUL",
        "message": f"Successfully reverted {clean_name} to release image {ver}."
    }
