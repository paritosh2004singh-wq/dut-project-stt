from __future__ import annotations

import re

_FILLER_WORDS = {
    "um",
    "uh",
    "erm",
    "ah",
    "er",
    "hmm",
    "mm",
    "like",
}

_TOKEN_RE = re.compile(r"\b[\w']+\b|[^\w\s]+|\s+")


def _is_word(token: str) -> bool:
    return bool(re.fullmatch(r"[\w']+", token))


def clean_final_transcript(text: str) -> str:
    """
    Conservative cleanup for finalized transcript text.

    Removes obvious filler tokens and adjacent duplicate words while keeping
    punctuation and spacing intact as much as possible.
    """
    if not text:
        return ""

    tokens = _TOKEN_RE.findall(text)
    cleaned_tokens: list[str] = []
    previous_word = ""

    for index, token in enumerate(tokens):
        if not token.strip():
            cleaned_tokens.append(token)
            continue

        if _is_word(token):
            normalized = token.lower()

            if normalized in _FILLER_WORDS:
                if normalized == "like":
                    prev_token = _previous_non_space_token(tokens, index)
                    next_token = _next_non_space_token(tokens, index)
                    if prev_token not in {"", ",", ";", ":"} and next_token not in {"", ",", ".", "!", "?", ";", ":"}:
                        cleaned_tokens.append(token)
                        previous_word = normalized
                        continue
                continue

            if previous_word == normalized:
                continue

            cleaned_tokens.append(token)
            previous_word = normalized
            continue

        cleaned_tokens.append(token)
        if token not in {",", ".", "!", "?", ";", ":"}:
            previous_word = ""

    cleaned = "".join(cleaned_tokens)
    cleaned = re.sub(r"\s+([,.;!?])", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def _previous_non_space_token(tokens: list[str], index: int) -> str:
    for previous_index in range(index - 1, -1, -1):
        token = tokens[previous_index]
        if token.strip():
            return token
    return ""


def _next_non_space_token(tokens: list[str], index: int) -> str:
    for next_index in range(index + 1, len(tokens)):
        token = tokens[next_index]
        if token.strip():
            return token
    return ""
