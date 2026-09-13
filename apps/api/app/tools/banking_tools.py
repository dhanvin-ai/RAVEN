"""
Fintech & Banking Operations Tools

Provides mock implementations for core banking operations:
- Balance inquiries
- Fund transfers (ACH / Wire)
- Account and card freezing
- Transaction history queries
"""

from typing import Any, Dict, List

MOCK_ACCOUNTS = {
    "ACC-8812": {
        "account_id": "ACC-8812",
        "holder": "Sarah Jenkins",
        "type": "Checking",
        "balance": 14250.75,
        "available_balance": 14250.75,
        "daily_limit": 5000.0,
        "status": "ACTIVE",
    },
    "ACC-4491": {
        "account_id": "ACC-4491",
        "holder": "David Miller",
        "type": "Savings",
        "balance": 89400.00,
        "available_balance": 89400.00,
        "daily_limit": 10000.0,
        "status": "ACTIVE",
    },
    "ACC-9901": {
        "account_id": "ACC-9901",
        "holder": "Elena Rostova",
        "type": "Checking",
        "balance": 3120.50,
        "available_balance": 0.0,
        "daily_limit": 1000.0,
        "status": "FROZEN",
    },
}

BLACKLISTED_ACCOUNTS = {"CY-9912", "FRAUD-666", "OFFSHORE-007"}


def get_balance(account_id: str = "", **kwargs) -> Dict[str, Any]:
    """Retrieve current and available balances for a given account."""
    acct = account_id or kwargs.get("account") or kwargs.get("id") or ""
    clean_id = str(acct).strip().upper()
    account = MOCK_ACCOUNTS.get(clean_id)
    if not account:
        return {
            "success": False,
            "error": f"Account {acct} not found in banking system."
        }
    return {
        "success": True,
        "account_id": account["account_id"],
        "account_type": account["type"],
        "balance": account["balance"],
        "available_balance": account["available_balance"],
        "status": account["status"],
        "currency": "USD"
    }


def transfer_funds(
    source_account: str = "",
    destination_account: str = "",
    amount: float = 0.0,
    **kwargs
) -> Dict[str, Any]:
    """Execute a fund transfer from source to destination account."""
    src = source_account or kwargs.get("from_account") or kwargs.get("source") or kwargs.get("src") or ""
    dest = destination_account or kwargs.get("to_account") or kwargs.get("destination") or kwargs.get("dest") or ""
    amt_raw = amount if amount != 0.0 else kwargs.get("amt", kwargs.get("amount", 0.0))
    try:
        amt = float(amt_raw)
    except (ValueError, TypeError):
        amt = 0.0

    src_id = str(src).strip().upper()
    dest_id = str(dest).strip().upper()

    if dest_id in BLACKLISTED_ACCOUNTS:
        return {
            "success": False,
            "error": f"TRANSFER_BLOCKED: Destination account {dest} is flagged for financial sanctions / AML violations."
        }

    account = MOCK_ACCOUNTS.get(src_id)
    if not account:
        return {
            "success": False,
            "error": f"Source account {src} not found."
        }

    if account["status"] == "FROZEN":
        return {
            "success": False,
            "error": f"TRANSFER_REJECTED: Source account {src} is currently FROZEN."
        }

    if amt <= 0:
        return {
            "success": False,
            "error": "Transfer amount must be greater than $0.00."
        }

    if amt > account["daily_limit"]:
        return {
            "success": False,
            "error": f"LIMIT_EXCEEDED: Requested transfer of ${amt:,.2f} exceeds the daily limit of ${account['daily_limit']:,.2f}. 2FA / Wire desk authorization required."
        }

    if amt > account["available_balance"]:
        return {
            "success": False,
            "error": f"INSUFFICIENT_FUNDS: Available balance is ${account['available_balance']:,.2f}, requested ${amt:,.2f}."
        }

    account["available_balance"] -= amt
    account["balance"] -= amt

    return {
        "success": True,
        "transaction_id": f"TXN-WIRE-{src_id[-4:]}-998",
        "source_account": src_id,
        "destination_account": dest_id,
        "amount_transferred": amt,
        "remaining_balance": account["available_balance"],
        "status": "COMPLETED",
        "message": f"Successfully transferred ${amt:,.2f} to {dest_id}."
    }


def freeze_account(account_id: str = "", reason: str = "Suspicious activity reported", **kwargs) -> Dict[str, Any]:
    """Temporarily suspends debit card and wire access for an account."""
    acct = account_id or kwargs.get("account") or kwargs.get("id") or ""
    clean_id = str(acct).strip().upper()
    account = MOCK_ACCOUNTS.get(clean_id)
    if not account:
        return {
            "success": False,
            "error": f"Account {acct} not found."
        }

    account["status"] = "FROZEN"
    account["available_balance"] = 0.0

    return {
        "success": True,
        "account_id": clean_id,
        "status": "FROZEN",
        "reason": reason,
        "message": f"Account {clean_id} has been frozen. All outgoing transactions suspended."
    }


def get_transaction_history(account_id: str = "", limit: int = 5, **kwargs) -> Dict[str, Any]:
    """Retrieve recent debit and credit transactions for an account."""
    acct = account_id or kwargs.get("account") or kwargs.get("id") or ""
    clean_id = str(acct).strip().upper()
    account = MOCK_ACCOUNTS.get(clean_id)
    if not account:
        return {
            "success": False,
            "error": f"Account {acct} not found."
        }

    try:
        lim = int(limit or kwargs.get("count", 5))
    except (ValueError, TypeError):
        lim = 5

    sample_txns = [
        {"id": "TXN-101", "date": "2026-09-08", "type": "DEBIT", "amount": 84.50, "description": "Whole Foods Market"},
        {"id": "TXN-102", "date": "2026-09-07", "type": "CREDIT", "amount": 3400.00, "description": "Direct Deposit - Payroll"},
        {"id": "TXN-103", "date": "2026-09-05", "type": "DEBIT", "amount": 14.99, "description": "Netflix Subscription"},
        {"id": "TXN-104", "date": "2026-09-03", "type": "DEBIT", "amount": 120.00, "description": "Chevron Gas Station"},
        {"id": "TXN-105", "date": "2026-09-01", "type": "DEBIT", "amount": 450.00, "description": "Utility Bill - Electric"},
    ]

    return {
        "success": True,
        "account_id": clean_id,
        "total_transactions": len(sample_txns),
        "transactions": sample_txns[:lim]
    }
