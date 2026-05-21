FROM python:3.11-slim

# build: 2026-05-21
WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/
COPY backend/init_db.py .
COPY backend/rag_init.py .
COPY backend/data/ ./data/

COPY backend/start.sh .
RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
