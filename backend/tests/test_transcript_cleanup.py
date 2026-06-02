import unittest

from app.services.transcript_cleanup import clean_final_transcript


class TranscriptCleanupTests(unittest.TestCase):
    def test_removes_fillers_and_duplicate_words(self) -> None:
        text = "Um hello hello world."

        self.assertEqual(clean_final_transcript(text), "hello world.")

    def test_preserves_meaningful_text(self) -> None:
        text = "We should go now, right?"

        self.assertEqual(clean_final_transcript(text), text)
