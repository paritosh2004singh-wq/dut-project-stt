FROM python:3.11-slim

WORKDIR /app

# Install uv via pip
RUN pip install --no-cache-dir uv

# Optional optimizations
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install project dependencies using uv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install \
    --system \
    --break-system-packages \
    -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8080

CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "8080"]