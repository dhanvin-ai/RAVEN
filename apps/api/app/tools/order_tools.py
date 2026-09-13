def get_order(order_id: str):
    """
    Fetch order details.
    """

    return {
        "order_id": order_id,
        "customer": "John Doe",
        "item": "MacBook Pro",
        "status": "shipped"
    }


def refund_order(order_id: str):
    """
    Process refund for an order.
    """

    return {
        "order_id": order_id,
        "status": "refund initiated",
        "message": "Refund will be processed within 5-7 working days"
    }


def cancel_order(order_id: str):
    """
    Cancel an order.
    """

    return {
        "order_id": order_id,
        "status": "cancelled",
        "message": "Your order has been cancelled successfully"
    }


def send_email(email: str, message: str):
    """
    Send email notification.
    """

    return {
        "email": email,
        "status": "sent",
        "message": message
    }