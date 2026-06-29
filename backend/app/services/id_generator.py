"""Meeting-code generation.

Zoom IDs are 10-11 numeric digits that look random but must be globally unique.
We generate cryptographically-strong random digits (so codes aren't guessable or
sequential) and retry on the rare collision. Isolated in its own module so the
strategy is easy to unit-test and to swap (e.g. for a snowflake/base32 scheme).
"""
from __future__ import annotations

import secrets
from collections.abc import Callable

# A small, fixed retry budget. With an 11-digit space (~10^11) against a handful
# of rows, a collision is astronomically unlikely; this is pure defensiveness.
_MAX_ATTEMPTS = 5


def _random_numeric_code(length: int) -> str:
    """Return a `length`-digit numeric string with a non-zero leading digit."""
    first = str(secrets.randbelow(9) + 1)                       # 1-9
    rest = "".join(str(secrets.randbelow(10)) for _ in range(length - 1))
    return first + rest


def generate_unique_code(length: int, exists: Callable[[str], bool]) -> str:
    """Generate a code not already present, per the `exists` predicate.

    `exists` is injected (rather than importing a repository) so this function
    stays pure and trivially testable: pass a lambda in tests, the real DB check
    in production.
    """
    for _ in range(_MAX_ATTEMPTS):
        candidate = _random_numeric_code(length)
        if not exists(candidate):
            return candidate
    raise RuntimeError("Could not allocate a unique meeting code; retry later.")


def format_display_code(code: str) -> str:
    """Pretty-print a raw code as Zoom does: groups of 3-4 (e.g. 874 2261 9043)."""
    if len(code) == 11:
        return f"{code[:3]} {code[3:7]} {code[7:]}"
    if len(code) == 10:
        return f"{code[:3]} {code[3:6]} {code[6:]}"
    return code
