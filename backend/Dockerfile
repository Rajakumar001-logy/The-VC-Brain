# FastAPI Multi-stage Production Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /backend

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install virtualenv and build dependencies
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Final production stage
FROM python:3.11-slim AS runner

WORKDIR /backend

# Setup path and environment
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Copy built virtualenv dependencies
COPY --from=builder /opt/venv /opt/venv

# Copy backend codebase
COPY . .

# Run as non-root user for security
RUN useradd -u 8888 appuser && chown -R appuser:appuser /backend
USER appuser

EXPOSE 8000

# Run uvicorn server in production
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
