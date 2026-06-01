import difflib
from dataclasses import dataclass, field
from typing import Optional
 
from app.models.messages import StatusKind
 
 
@dataclass
class TranscriptState:
    fast_full_text: str = ""
    slow_full_text: str = ""
 
    fast_status: StatusKind = StatusKind.CONNECTING
    slow_status: StatusKind = StatusKind.CONNECTING
 
    fast_done: bool = False
    slow_done: bool = False
 
    error: Optional[str] = None
 
    # ── Mutation helpers ──────────────────────────────────────────────────────
 
    def append_fast(self, delta: str) -> None:
        self.fast_full_text += delta
 
    def append_slow(self, delta: str) -> None:
        self.slow_full_text += delta
 
    def set_fast_status(self, status: StatusKind) -> None:
        self.fast_status = status
        if status == StatusKind.DONE:
            self.fast_done = True
 
    def set_slow_status(self, status: StatusKind) -> None:
        self.slow_status = status
        if status == StatusKind.DONE:
            self.slow_done = True
 
    def set_error(self, message: str) -> None:
        self.error = message
        self.fast_status = StatusKind.ERROR
        self.slow_status = StatusKind.ERROR
 
    @property
    def is_finished(self) -> bool:
        return self.fast_done and self.slow_done
 
    @property
    def has_error(self) -> bool:
        return self.error is not None
 
    # ── Diff-merge algorithm ──────────────────────────────────────────────────
 
    @staticmethod
    def _normalize_word(word: str) -> str:
        """Strip punctuation and lowercase for fuzzy matching."""
        return word.strip(".,!?;:\"'()[]{}").lower()
 
    def compute_display(self) -> tuple[str, str]:
        """
        Returns (confirmed_text, partial_text).
 
        confirmed_text  – the portion the slow stream has covered
        partial_text    – words in the fast stream beyond the slow cursor
                          (prefixed with a space for direct concatenation)
 
        Algorithm (same as original Python CLI reference):
        1. Split both streams into word lists and normalise for comparison.
        2. Use difflib.SequenceMatcher to find matching blocks.
        3. Track how far into the slow word list the matching advances.
        4. Words in the fast list beyond that point are "partial" (ahead).
        """
        slow_words = self.slow_full_text.split()
        fast_words = self.fast_full_text.split()
 
        # Nothing confirmed yet – show everything from fast as partial
        if not slow_words:
            partial = (" " + self.fast_full_text).rstrip() if fast_words else ""
            return "", partial
 
        slow_norm = [self._normalize_word(w) for w in slow_words]
        fast_norm = [self._normalize_word(w) for w in fast_words]
 
        matcher = difflib.SequenceMatcher(None, slow_norm, fast_norm, autojunk=False)
 
        last_fast_index: int = 0
        slow_progress: int = 0
 
        for block in matcher.get_matching_blocks():
            if block.size == 0:
                continue
            slow_end = block.a + block.size
            if slow_end > slow_progress:
                slow_progress = slow_end
                last_fast_index = block.b + block.size
 
        if last_fast_index < len(fast_words):
            ahead = fast_words[last_fast_index:]
            partial_text = " " + " ".join(ahead)
        else:
            partial_text = ""
 
        return self.slow_full_text, partial_text
