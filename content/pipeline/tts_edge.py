"""Neurální hlas (Microsoft přes edge-tts) pro podcast.

Skript epizody obsahuje pauzy ve tvaru `[[slnc 4500]]` (řídicí příkaz `say`).
edge-tts vlastní SSML nepustí, takže se text rozseká na úseky mezi pauzami,
každý úsek se namluví zvlášť a ticho se vloží při skládání. Skládá se
v PCM přes macOS `afconvert` (MP3 → WAV a hotové WAV → AAC .m4a) — ffmpeg
není potřeba a ven odchází jen text úseků.

Úseky se cachují podle (hlas, rychlost, text): oprava jedné karty pak
nenamlouvá znovu celou epizodu.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import edge_tts

RATE = "-6%"  # o chlup pomaleji než výchozí — odborné pojmy potřebují čas
SAMPLE_RATE = 24000
CACHE = Path(__file__).resolve().parent.parent / ".tts-cache"
CONCURRENCY = 4
_PAUSE = re.compile(r"\[\[slnc (\d+)\]\]")


def segments(script: str) -> list[str | int]:
    """Text a pauzy (int = ms) v pořadí; prázdné úseky pryč, sousední pauzy sečtené."""
    out: list[str | int] = []
    pos = 0
    for m in _PAUSE.finditer(script):
        text = " ".join(script[pos:m.start()].split())
        if text:
            out.append(text)
        ms = int(m.group(1))
        if out and isinstance(out[-1], int):
            out[-1] += ms
        else:
            out.append(ms)
        pos = m.end()
    tail = " ".join(script[pos:].split())
    if tail:
        out.append(tail)
    return out


def _key(voice: str, text: str) -> Path:
    h = hashlib.sha256(f"{voice}|{RATE}|{text}".encode()).hexdigest()[:24]
    return CACHE / voice / f"{h}.wav"


async def _speak(text: str, voice: str, sem: asyncio.Semaphore) -> None:
    target = _key(voice, text)
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(4):
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    mp3 = Path(tmp) / "s.mp3"
                    await edge_tts.Communicate(text, voice, rate=RATE).save(str(mp3))
                    part = Path(tmp) / "s.wav"
                    subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}",
                                    "-c", "1", str(mp3), str(part)], check=True)
                    part.replace(target)
                return
            except Exception:  # síť / limit — chvíli počkat a zkusit znovu
                if attempt == 3:
                    raise
                await asyncio.sleep(2 * (attempt + 1))


def render_edge(script: str, voice: str, target: Path) -> None:
    parts = segments(script)
    texts = sorted({p for p in parts if isinstance(p, str)})

    async def run() -> None:
        sem = asyncio.Semaphore(CONCURRENCY)
        await asyncio.gather(*(_speak(t, voice, sem) for t in texts))

    asyncio.run(run())
    with tempfile.TemporaryDirectory() as tmp:
        joined = Path(tmp) / "episode.wav"
        with wave.open(str(joined), "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(SAMPLE_RATE)
            for p in parts:
                if isinstance(p, int):
                    out.writeframes(b"\0\0" * (SAMPLE_RATE * p // 1000))
                    continue
                with wave.open(str(_key(voice, p)), "rb") as seg:
                    out.writeframes(seg.readframes(seg.getnframes()))
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000",
                        str(joined), str(target)], check=True)
