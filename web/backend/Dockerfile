FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_DEBUG=False

WORKDIR /app

# Install system dependencies including fonts for PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    fonts-liberation2 \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -fv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN chmod +x ./cloudrun-entrypoint.sh \
    && python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["./cloudrun-entrypoint.sh"]
