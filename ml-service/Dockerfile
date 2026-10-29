# KezSpeak ML service as a Hugging Face Docker Space (see DEPLOYMENT.md).
# Secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
# KEZSPEAK_API_KEY, ALLOWED_ORIGINS) come from the Space settings, never this file.
FROM python:3.11-slim

# Java runs LanguageTool for the grammar-error count.
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Spaces run the container as uid 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt \
    && python -m spacy download en_core_web_sm

# Download Whisper and LanguageTool at build time so the first learner
# doesn't wait for several hundred MB of downloads.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')" \
    && python -c "import language_tool_python as lt; tool = lt.LanguageTool('en-US'); tool.close()"

COPY --chown=user app ./app
COPY --chown=user model ./model

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
