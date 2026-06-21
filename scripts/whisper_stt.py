#!/usr/bin/env python3
"""
Whisper STT wrapper untuk Javas Bot WA.
Menerima satu argument: path ke file audio.
Mencetak hasil transkripsi ke stdout.

Penggunaan: python whisper_stt.py <path_audio>
Set di .env: STT_COMMAND=python C:/Users/axioo/Documents/bot wa/scripts/whisper_stt.py
"""

import sys
import os
import tempfile
import subprocess

def transcribe(audio_path: str) -> str:
    try:
        import whisper
    except ImportError:
        print("[ERROR] openai-whisper belum terinstall. Jalankan: python -m pip install openai-whisper", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(audio_path):
        print(f"[ERROR] File tidak ditemukan: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # Gunakan model "base" - cepat dan ringan, cukup akurat untuk bahasa Indonesia
    # Model options: tiny, base, small, medium, large (makin besar makin akurat tapi lambat)
    model_name = os.environ.get("WHISPER_MODEL", "base")

    try:
        model = whisper.load_model(model_name)
        result = model.transcribe(
            audio_path,
            language=None,  # auto-detect language
            task="transcribe",
            verbose=False
        )
        text = result.get("text", "").strip()
        print(text)
    except Exception as e:
        print(f"[ERROR] Transkripsi gagal: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("[ERROR] Harap berikan path file audio sebagai argument.", file=sys.stderr)
        print(f"Penggunaan: python {sys.argv[0]} <path_audio>", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    transcribe(audio_path)
