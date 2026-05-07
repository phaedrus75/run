"""
LLM client — thin, single-purpose wrapper.
==========================================

Goals:
- Keep the rest of the codebase ignorant of model SDKs.
- Support a STUB mode so the coach module can be exercised in tests,
  evals, and CI without any API key or network call.
- Centralise model name, temperature, and timeout decisions.

Provider: Anthropic Claude (Sonnet) for the brand voice. The wrapper
loads the SDK lazily so the import is free if no key is set.

Configuration via environment:
    COACH_LLM_MODE        = "stub" | "anthropic"   (default: stub if no key)
    ANTHROPIC_API_KEY     = "..."
    COACH_LLM_MODEL       = "claude-sonnet-4-5"     (default: claude-sonnet-4-5)
    COACH_LLM_MAX_TOKENS  = 800                    (default per task in coach.py)
"""

from __future__ import annotations

import json
import os
from typing import Iterable, List, Optional


DEFAULT_MODEL = os.getenv("COACH_LLM_MODEL", "claude-sonnet-4-5")
DEFAULT_TIMEOUT_SECONDS = 30


def _resolve_mode() -> str:
    explicit = os.getenv("COACH_LLM_MODE")
    if explicit:
        return explicit.lower()
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    return "stub"


def is_live() -> bool:
    """True if a real LLM call will happen on `complete()`."""
    return _resolve_mode() != "stub"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def complete(
    *,
    system: str,
    messages: List[dict],
    max_tokens: int = 600,
    temperature: float = 0.7,
    model: Optional[str] = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> str:
    """Synchronous completion. Returns the model's text reply.

    Args:
        system: The full composed system prompt.
        messages: List of {"role": "user" | "assistant", "content": "..."}.
        max_tokens: Cap on output length.
        temperature: 0.0–1.0. Coach default is moderate (0.7) for warmth.
        model: Override default model.
        timeout_seconds: Network timeout.

    Returns:
        Plain text response. JSON tasks parse it themselves.
    """
    mode = _resolve_mode()
    if mode == "stub":
        return _stub_complete(system=system, messages=messages, max_tokens=max_tokens)
    if mode == "anthropic":
        return _anthropic_complete(
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            model=model or DEFAULT_MODEL,
            timeout_seconds=timeout_seconds,
        )
    raise RuntimeError(f"Unknown COACH_LLM_MODE: {mode!r}")


# ---------------------------------------------------------------------------
# Anthropic backend (lazy import)
# ---------------------------------------------------------------------------

_anthropic_client = None  # cached singleton


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is not None:
        return _anthropic_client
    try:
        import anthropic  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "COACH_LLM_MODE=anthropic but the `anthropic` package is not installed. "
            "Add `anthropic` to requirements.txt."
        ) from exc
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set.")
    _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


def _anthropic_complete(
    *,
    system: str,
    messages: List[dict],
    max_tokens: int,
    temperature: float,
    model: str,
    timeout_seconds: int,
) -> str:
    client = _get_anthropic_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=messages,
        timeout=timeout_seconds,
    )
    parts = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    return "".join(parts).strip()


# ---------------------------------------------------------------------------
# Stub backend — deterministic, recognisable, brand-on
# ---------------------------------------------------------------------------

def _stub_complete(*, system: str, messages: List[dict], max_tokens: int) -> str:
    """Return a plausible-looking, brand-on response based on signals in
    the system prompt. Used for evals, tests, and local dev without a key.

    The stub is intentionally bland but voice-correct, so eval outputs are
    readable and obvious as stubs.
    """
    s = system.lower()

    if "task: write a coach's note" in s or "task: write a coach\u2019s note" in s:
        return _stub_run_note(messages)

    if "task: write today's recommendation" in s or "task: write today\u2019s recommendation" in s:
        return _stub_today_card(messages)

    if "task: pre-generate the in-run companion script" in s:
        return _stub_run_script(messages)

    if "task: open chat with the user" in s:
        return _stub_chat(messages)

    return "[stub] No matching task layer detected."


def _last_user_text(messages: List[dict]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return str(m.get("content", ""))
    return ""


def _stub_run_note(messages: List[dict]) -> str:
    return (
        "A quiet one. The route looked steady, the mood about right for the week. "
        "Walk tomorrow if it asks."
    )


def _stub_today_card(messages: List[dict]) -> str:
    return "An easy six along the river. Take it slow."


def _stub_chat(messages: List[dict]) -> str:
    last = _last_user_text(messages)
    if not last:
        return "Tell me where you are with running this week and we'll go from there."
    return (
        "Short answer: keep it easy this week. The pattern in the last fortnight "
        "earns a softer one. Tell me what you're hoping to do on Saturday and I'll suggest a route."
    )


def _stub_run_script(messages: List[dict]) -> str:
    return json.dumps(
        {
            "lines": [
                {"trigger": "start", "text": "Off you go. Settle in for a minute or two."},
                {"trigger": "km", "km": 1, "text": "One kilometre. Easy as you like."},
                {"trigger": "halfway", "text": "Halfway. The view ahead is the one to keep."},
                {"trigger": "km_to_go", "remaining_km": 1, "text": "One to go. Take it home."},
                {"trigger": "finish", "text": "Done. Sit somewhere nice."},
            ]
        }
    )
