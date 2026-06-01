import asyncio
import logging
from typing import AsyncIterator
 
logger = logging.getLogger(__name__)
 
_QUEUE_MAXSIZE = 100
 
 
class AudioBroadcaster:
    def __init__(self, n_streams: int = 2) -> None:
        self._queues: list[asyncio.Queue[bytes | None]] = [
            asyncio.Queue(maxsize=_QUEUE_MAXSIZE) for _ in range(n_streams)
        ]
        self._stopped = False
 
    # ── Producer side (called by WebSocket handler) ───────────────────────────
 
    async def put(self, chunk: bytes) -> None:
        """Broadcast a PCM chunk to all queues."""
        if self._stopped:
            return
        for q in self._queues:
            try:
                q.put_nowait(chunk)
            except asyncio.QueueFull:
                # Drop oldest chunk and insert the new one to keep real-time
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(chunk)
                except asyncio.QueueFull:
                    logger.warning("Audio queue still full after drop — skipping chunk")
 
    async def stop(self) -> None:
        """Signal all consumers that the stream is over."""
        self._stopped = True
        for q in self._queues:
            # Drain and push sentinel
            while True:
                try:
                    q.put_nowait(None)
                    break
                except asyncio.QueueFull:
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        break
 
    # ── Consumer side (called by transcription service) ───────────────────────
 
    async def iter_stream(self, index: int) -> AsyncIterator[bytes]:
        """Yield PCM chunks for stream `index` until stopped."""
        q = self._queues[index]
        while True:
            chunk = await q.get()
            if chunk is None:
                break
            yield chunk
 
    @property
    def fast_queue_index(self) -> int:
        return 0
 
    @property
    def slow_queue_index(self) -> int:
        return 1
 
