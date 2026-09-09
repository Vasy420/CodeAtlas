# Northstar

A tiny shop backend used as ORION's demo corpus — intentionally interconnected so change-impact is obvious.

- `auth/session.py` is a god module — orders, permissions, and routes all depend on it
- `db.py` is imported by models, inventory, and session
- Changing `orders/service.py` should not take down auth
