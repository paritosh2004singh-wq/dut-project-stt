"""
Tests for the STT worker translation handoff.

These tests are self-contained so they can run even in environments that do
not have the full backend dependency stack installed.
"""

from __future__ import annotations

import asyncio
import os
import sys
import types
import unittest
from enum import Enum
from unittest.mock import AsyncMock, patch

# Ensure the backend root is on the path.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _install_import_stubs() -> None:
    """Install lightweight module stubs so worker_stt imports cleanly."""
    if "mistralai" not in sys.modules:
        mistralai_mod = types.ModuleType("mistralai")
        mistralai_mod.__path__ = []
        mistralai_client_mod = types.ModuleType("mistralai.client")
        mistralai_client_mod.__path__ = []
        mistralai_client_models_mod = types.ModuleType("mistralai.client.models")

        class _FakeMistral:
            def __init__(self, *args, **kwargs):
                pass

        class _FakeAudioFormat:
            def __init__(self, *args, **kwargs):
                self.encoding = kwargs.get("encoding")
                self.sample_rate = kwargs.get("sample_rate")

        mistralai_client_mod.Mistral = _FakeMistral
        mistralai_client_models_mod.AudioFormat = _FakeAudioFormat
        sys.modules["mistralai"] = mistralai_mod
        sys.modules["mistralai.client"] = mistralai_client_mod
        sys.modules["mistralai.client.models"] = mistralai_client_models_mod

    app_mod = sys.modules.setdefault("app", types.ModuleType("app"))
    app_mod.__path__ = getattr(app_mod, "__path__", [])

    core_mod = sys.modules.setdefault("app.core", types.ModuleType("app.core"))
    core_mod.__path__ = getattr(core_mod, "__path__", [])

    models_mod = sys.modules.setdefault("app.models", types.ModuleType("app.models"))
    models_mod.__path__ = getattr(models_mod, "__path__", [])

    services_mod = sys.modules.setdefault("app.services", types.ModuleType("app.services"))
    services_mod.__path__ = getattr(services_mod, "__path__", [])

    config_mod = types.ModuleType("app.core.config")

    class _Settings:
        mistral_api_key = "test-key"
        mistral_base_url = "http://localhost"
        mistral_model = "test-model"

    config_mod.settings = _Settings()

    redis_mod = types.ModuleType("app.core.redis")
    redis_mod.redis_client = types.SimpleNamespace()
    redis_mod.init_redis_groups = AsyncMock()
    redis_mod.publish_session_event = AsyncMock()
    redis_mod.publish_translate_job = AsyncMock()

    messages_mod = types.ModuleType("app.models.messages")

    class StreamKind(str, Enum):
        FAST = "fast"
        SLOW = "slow"

    messages_mod.StreamKind = StreamKind

    transcript_state_mod = types.ModuleType("app.services.transcript_state")

    class TranscriptState:
        def __init__(self, fast_full_text: str = "", slow_full_text: str = ""):
            self.fast_full_text = fast_full_text
            self.slow_full_text = slow_full_text
            self.has_error = False
            self.is_finished = False

        def compute_display(self):
            return self.slow_full_text, ""

    transcript_state_mod.TranscriptState = TranscriptState

    transcription_runner_mod = types.ModuleType("app.services.transcription_runner")

    async def run_stream(*args, **kwargs):
        return None

    transcription_runner_mod.run_stream = run_stream

    cleanup_mod = types.ModuleType("app.services.transcript_cleanup")

    def clean_final_transcript(text: str) -> str:
        return text

    cleanup_mod.clean_final_transcript = clean_final_transcript

    translation_mod = types.ModuleType("app.services.translation")

    async def translate_transcription_advanced(*args, **kwargs):
        return {"success": True, "translated_text": "test"}

    translation_mod.translate_transcription_advanced = translate_transcription_advanced

    sys.modules["app.core.config"] = config_mod
    sys.modules["app.core.redis"] = redis_mod
    sys.modules["app.models.messages"] = messages_mod
    sys.modules["app.services.transcript_state"] = transcript_state_mod
    sys.modules["app.services.transcription_runner"] = transcription_runner_mod
    sys.modules["app.services.transcript_cleanup"] = cleanup_mod
    sys.modules["app.services.translation"] = translation_mod


_install_import_stubs()

from worker_stt import STTSessionOrchestrator  # noqa: E402


class TestWorkerSttEnglishTranslation(unittest.IsolatedAsyncioTestCase):
    async def test_inline_translation_runs_for_english_default(self):
        with patch("worker_stt.translate_transcription_advanced", new_callable=AsyncMock) as mock_translate, \
             patch("worker_stt.publish_session_event", new_callable=AsyncMock) as mock_publish_event:

            mock_translate.return_value = {
                "success": True,
                "translated_text": "hello world",
            }

            orch = STTSessionOrchestrator(
                session_id="session-english",
                target_language="English",
                translate_to_english=True,
            )
            orch.state.fast_full_text = "नमस्ते दुनिया"
            orch.state.slow_full_text = "नमस्ते दुनिया"

            await orch.process_speech_ended()

            mock_translate.assert_awaited_once_with(
                transcription="नमस्ते दुनिया",
                target_language="English",
            )

            mock_publish_event.assert_any_await("session-english", {"type": "translation_started"})
            mock_publish_event.assert_any_await(
                "session-english",
                {"type": "translation_complete", "translated_text": "hello world"},
            )

    async def test_non_english_language_still_queues_translate_job(self):
        with patch("worker_stt.publish_translate_job", new_callable=AsyncMock) as mock_translate_job, \
             patch("worker_stt.translate_transcription_advanced", new_callable=AsyncMock) as mock_translate:

            orch = STTSessionOrchestrator(
                session_id="session-hindi",
                target_language="Hindi",
                translate_to_english=False,
            )
            orch.state.fast_full_text = "hello"
            orch.state.slow_full_text = "hello"

            await orch.process_speech_ended()

            mock_translate.assert_not_awaited()
            mock_translate_job.assert_awaited_once_with("session-hindi", "hello", "Hindi")


if __name__ == "__main__":
    unittest.main()
