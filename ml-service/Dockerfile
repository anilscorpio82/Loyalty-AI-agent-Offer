FROM python:3.11-slim

WORKDIR /app

# Install OS dependencies for PostgreSQL binding
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements or install directly (for this prototype we install directly)
RUN pip install --no-cache-dir fastapi uvicorn scikit-learn pandas psycopg2-binary sqlalchemy lightgbm

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
