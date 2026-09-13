from typing import Any


# Demo order database.
# Later, this will be replaced by PostgreSQL.
ORDERS: dict[int, dict[str, Any]] = {
    1234: {
        "order_id": 1234,
        "amount": 2000,
        "status": "delivered",
        "refund_eligible": True,
    },
    5678: {
        "order_id": 5678,
        "amount": 1500,
        "status": "processing",
        "refund_eligible": False,
    },
}


def get_order(order_id: int) -> dict[str, Any]:
    """Look up an order by its ID."""

    order = ORDERS.get(order_id)

    if order is None:
        return {
            "success": False,
            "message": f"Order #{order_id} was not found.",
        }

    return {
        "success": True,
        "order": order,
    }


def refund_order(order_id: int) -> dict[str, Any]:
    """Refund an eligible order."""

    order = ORDERS.get(order_id)

    if order is None:
        return {
            "success": False,
            "message": f"Order #{order_id} was not found.",
        }

    if not order["refund_eligible"]:
        return {
            "success": False,
            "message": f"Order #{order_id} is not eligible for a refund.",
        }

    return {
        "success": True,
        "message": f"Refund initiated for order #{order_id}.",
        "amount": order["amount"],
    }


def cancel_order(order_id: int) -> dict[str, Any]:
    """Cancel an order."""

    order = ORDERS.get(order_id)

    if order is None:
        return {
            "success": False,
            "message": f"Order #{order_id} was not found.",
        }

    if order["status"] == "delivered":
        return {
            "success": False,
            "message": f"Order #{order_id} cannot be cancelled because it has already been delivered.",
        }

    order["status"] = "cancelled"

    return {
        "success": True,
        "message": f"Order #{order_id} has been cancelled.",
    }


def send_email(
    email: str,
    subject: str,
    message: str,
) -> dict[str, Any]:
    """Demo email tool."""

    # We don't actually send an email yet.
    # Later this will connect to an email service.

    return {
        "success": True,
        "message": f"Email prepared for {email}.",
        "subject": subject,
        "body": message,
    }