from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_api_exposes_only_the_normative_scope_vocabulary() -> None:
    auth = (ROOT / "services/api/src/auth.ts").read_text(encoding="utf-8")
    expected = {
        "sources:read",
        "records:read",
        "events:read",
        "status:read",
        "webhooks:manage",
        "admin:sources",
        "admin:incidents",
    }
    for scope in expected:
        assert f'| "{scope}"' in auth
    for obsolete in ("sources:approve", "incidents:write", "webhooks:write"):
        assert obsolete not in auth


def test_admin_and_webhook_routes_require_their_exact_scopes() -> None:
    admin = (ROOT / "services/api/src/routes/admin.ts").read_text(encoding="utf-8")
    webhooks = (ROOT / "services/api/src/routes/webhooks.ts").read_text(encoding="utf-8")
    assert '["admin:sources"]' in admin
    assert admin.count('["admin:incidents"]') == 6
    assert webhooks.count('["webhooks:manage"]') == 4
