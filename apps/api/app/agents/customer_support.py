import re
from typing import Any

from app.agents.tools import (
    get_order,
    refund_order,
)


class CustomerSupportAgent:
    """Simple demo customer support agent."""

    def run(self, user_message: str) -> dict[str, Any]:
        """Process a customer request."""

        order_id = self._extract_order_id(user_message)

        if order_id is None:
            return {
                "success": False,
                "message": "Please provide a valid order number.",
                "steps": [],
            }

        message_lower = user_message.lower()

        if "refund" in message_lower:
            return self._handle_refund(order_id)

        return {
            "success": True,
            "message": (
                f"I found order #{order_id}, but I don't yet know "
                "how to handle that request."
            ),
            "steps": [],
        }

    def _handle_refund(self, order_id: int) -> dict[str, Any]:
        """Handle a refund request."""

        steps: list[dict[str, Any]] = []

        # Step 1: Get the order.
        steps.append(
            {
                "agent": f"I'll check your order first.",
                "tool": "get_order",
                "input": {"order_id": order_id},
            }
        )

        order_result = get_order(order_id)

        if not order_result["success"]:
            return {
                "success": False,
                "message": order_result["message"],
                "steps": steps,
            }

        order = order_result["order"]

        steps.append(
            {
                "tool": "get_order",
                "result": order_result,
            }
        )

        # Step 2: Check refund eligibility.
        if not order["refund_eligible"]:
            return {
                "success": False,
                "message": (
                    f"Order #{order_id} is not eligible for a refund."
                ),
                "steps": steps,
            }

        steps.append(
            {
                "agent": "The order is eligible for a refund.",
            }
        )

        # Step 3: Refund the order.
        steps.append(
            {
                "tool": "refund_order",
                "input": {"order_id": order_id},
            }
        )

        refund_result = refund_order(order_id)

        steps.append(
            {
                "tool": "refund_order",
                "result": refund_result,
            }
        )

        if not refund_result["success"]:
            return {
                "success": False,
                "message": refund_result["message"],
                "steps": steps,
            }

        return {
            "success": True,
            "message": (
                f"Refund initiated successfully for order #{order_id}. "
                f"Amount: ₹{refund_result['amount']:,}."
            ),
            "steps": steps,
        }

    @staticmethod
    def _extract_order_id(message: str) -> int | None:
        """Extract an order number such as #1234 from a message."""

        match = re.search(r"#?(\d{3,})", message)

        if match is None:
            return None

        return int(match.group(1))