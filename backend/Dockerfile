FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Binds the platform's $PORT (Render) and falls back to 7860 otherwise
EXPOSE 7860
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}
