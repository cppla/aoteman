"""Discoverable API contract; deliberately no authenticated player listing."""


def ref(name):
    return {"$ref": "#/components/schemas/" + name}


def json_response(description, schema):
    return {"description": description, "content": {"application/json": {"schema": schema}}}


def specification():
    counter = {"type": "integer", "minimum": 0, "maximum": 10000000}
    gauge = {"type": "number", "minimum": 0, "maximum": 100}
    milliseconds = {"type": "number", "minimum": 1, "maximum": 8640000000000000, "description": "Unix time in milliseconds; future times are capped at server time."}
    state_properties = {
        "version": {"type": "integer", "enum": [1, 2]},
        **{key: gauge for key in ("food", "energy", "mood")},
        **{key: counter for key in ("xp", "stars", "wins", "training", "fed", "blocks", "pats")},
        "born": milliseconds, "updated": milliseconds,
        **{key: {"type": "boolean"} for key in ("sleeping", "grown", "sound")},
        "difficulty": {"type": "string", "enum": ["easy", "normal"]},
        "scene": {"type": "string", "enum": ["base", "moon", "sunset"]},
        "unlocked": {"type": "array", "items": {"type": "string", "enum": ["base", "moon", "sunset"]}},
        "defeated": {"type": "array", "items": {"type": "string", "enum": ["obsidian", "lava", "cosmic"]}},
        "daily": {"type": "object", "properties": {
            "date": {"type": "string", "pattern": r"^\d{4}-\d{1,2}-\d{1,2}$", "description": "Player-local calendar date (e.g. 2026-9-7), preserved by server."},
            **{key: counter for key in ("fed", "training", "battles")}, "claimed": {"type": "boolean"},
        }},
        "journal": {"type": "array", "description": "Up to the first 30 valid entries are retained; text is truncated to 160 characters.", "items": {"type": "object", "properties": {"text": {"type": "string"}, "at": {"type": "number"}}, "required": ["text", "at"]}},
    }
    revision = {"type": "integer", "minimum": 1, "maximum": 9007199254740991}
    mutation = {"type": "string", "minLength": 8, "maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$", "description": "Unique ID for one write (UUID recommended). Persist before requesting and reuse only for retries of the same operation."}
    schemas = {
        "State": {"type": "object", "required": ["version", "food", "energy", "mood"], "properties": state_properties, "description": "Accepts browser save versions 1 and 2; emits normalized version 2. Unknown fields are removed. Missing legacy counters default to zero. Invalid numeric fields are rejected. Unsupported future versions are never silently downgraded."},
        "Snapshot": {"type": "object", "required": ["profileId", "revision", "state", "updatedAt"], "properties": {"profileId": {"type": "string", "format": "uuid"}, "revision": revision, "state": ref("State"), "updatedAt": {"type": "string", "format": "date-time"}}},
        "WriteSnapshot": {"allOf": [ref("Snapshot"), {"type": "object", "required": ["mutationRevision"], "properties": {"mutationRevision": {**revision, "description": "Revision at which this mutation was originally committed. On a retry this may be older than revision, which always describes the current head."}}}]},
        "Error": {"type": "object", "required": ["error"], "properties": {"error": {"type": "object", "required": ["code", "message"], "properties": {"code": {"type": "string"}, "message": {"type": "string"}}}}},
        "Conflict": {"allOf": [ref("Error"), {"type": "object", "required": ["current"], "properties": {"current": ref("Snapshot")}}]},
        "CreateProfile": {"type": "object", "required": ["recoveryCode", "state"], "properties": {"recoveryCode": {"type": "string", "pattern": "^gxy_[0-9a-f]{64}$", "description": "Client-generated 256-bit random secret; persist locally before the first request. The server stores only SHA-256."}, "state": ref("State")}},
        "SaveRequest": {"type": "object", "required": ["baseRevision", "mutationId", "state"], "properties": {"baseRevision": revision, "mutationId": mutation, "state": ref("State"), "reason": {"type": "string", "minLength": 1, "maxLength": 120, "default": "save"}}},
        "RestoreRequest": {"type": "object", "required": ["baseRevision", "mutationId", "revision"], "properties": {"baseRevision": revision, "mutationId": mutation, "revision": revision}},
        "History": {"type": "object", "required": ["versions"], "properties": {"versions": {"type": "array", "maxItems": 50, "items": {"type": "object", "required": ["revision", "createdAt", "reason", "xp", "wins", "stars"], "properties": {"revision": revision, "createdAt": {"type": "string", "format": "date-time"}, "reason": {"type": "string"}, **{key: counter for key in ("xp", "wins", "stars")}}}}}},
        "Health": {"type": "object", "required": ["status", "storage", "schemaVersion"], "properties": {"status": {"type": "string", "enum": ["ok"]}, "storage": {"type": "string", "enum": ["sqlite"]}, "schemaVersion": {"type": "integer"}}},
    }
    errors = {str(status): json_response(description, ref("Error")) for status, description in ((400, "Invalid JSON, request, or state"), (401, "Missing, malformed, or unknown recovery code"), (413, "Body exceeds 100 KiB"), (415, "Use application/json"), (503, "Storage temporarily unavailable; retain the local save and retry"))}

    def operation(summary, result, body=None, public=False, description=""):
        value = {"summary": summary, "description": description, "security": [] if public else [{"RecoveryCode": []}], "responses": {"200": json_response("Success", result), **errors}}
        if body:
            value["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(body)}}, "x-max-body-bytes": 102400}
        return value

    create = operation("Create a player or retry an existing creation", ref("Snapshot"), "CreateProfile", public=True, description="Generate the recovery code with a cryptographically secure RNG and save it locally before requesting. Reusing an existing code returns the current snapshot and never overwrites it; the supplied state is ignored for such retries.")
    create["responses"]["201"] = json_response("Player created at revision 1", ref("Snapshot"))
    save = operation("Save with optimistic concurrency", ref("WriteSnapshot"), "SaveRequest", description="A successful mutation ID is remembered permanently per player. Retrying it returns the current head without writing again, even if baseRevision is now stale. mutationRevision identifies the original successful revision. A new mutation with stale baseRevision returns 409 and the current snapshot; the caller must resolve the conflict.")
    save["responses"]["409"] = json_response("revision_conflict", ref("Conflict"))
    restore = operation("Restore a retained version as a new revision", ref("WriteSnapshot"), "RestoreRequest", description="Preserves the current head in history, then writes the selected historical state as a new revision. Retains the newest 100 revisions per player; history lists the latest 50. Uses the same concurrency and idempotency rules as PUT /api/v1/save.")
    restore["responses"]["409"] = json_response("revision_conflict", ref("Conflict"))
    restore["responses"]["404"] = json_response("version_not_found", ref("Error"))
    export = operation("Download the authenticated save as JSON", ref("Snapshot"))
    export["responses"]["200"]["headers"] = {"Content-Disposition": {"schema": {"type": "string"}, "description": "attachment; filename=aoteman-save.json"}}
    return {
        "openapi": "3.0.3", "info": {"title": "银河小伙伴存档 API", "version": "1.0.0", "description": "Same-origin SQLite save API. Recovery codes are bearer credentials: keep them private and use HTTPS. No player enumeration or public reads by ID. Responses are never cached. All mutations require JSON and a body of at most 100 KiB."},
        "servers": [{"url": "/"}],
        "paths": {
            "/api/healthz": {"get": operation("Storage readiness", ref("Health"), public=True)},
            "/api/openapi.json": {"get": operation("This OpenAPI document", {"type": "object"}, public=True)},
            "/api/v1/profiles": {"post": create},
            "/api/v1/save": {"get": operation("Read current authenticated save", ref("Snapshot")), "put": save},
            "/api/v1/history": {"get": operation("List the most recent 50 retained revisions", ref("History"))},
            "/api/v1/restore": {"post": restore}, "/api/v1/export": {"get": export},
        },
        "components": {"securitySchemes": {"RecoveryCode": {"type": "http", "scheme": "bearer", "bearerFormat": "gxy_<64 lowercase hex>", "description": "Recovery code created on the player's device; not a profile ID."}}, "schemas": schemas},
    }
