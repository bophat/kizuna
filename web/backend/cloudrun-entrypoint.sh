#!/bin/sh
set -eu

python manage.py migrate --noinput

exec gunicorn core.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
