FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_DEBUG=False

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN chmod +x ./cloudrun-entrypoint.sh \
    && python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["./cloudrun-entrypoint.sh"]
