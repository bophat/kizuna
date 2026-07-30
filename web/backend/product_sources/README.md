# Amazon Japan / Qoo10 product sources

This Django app provides one shared service layer for REST, CSV import, MCP tools,
and source synchronization. Products created by source or CSV import are saved as
`draft`; the public catalog only returns `published` products.

## Current implementation

- Domain models and migrations for source metadata, price history, jobs, category
  mappings, and audit logs.
- Amazon Japan and Qoo10 Japan URL parsing, SSRF validation, normalization, and
  Decimal-only pricing.
- Admin preview, single import, bulk import, single sync, and bulk sync REST APIs.
- Backward-compatible CSV endpoint using the shared pricing/import services.
- FastMCP tools for preview, import, bulk import, sync, price calculation, review
  queries, and CSV generation.
- Dry-run for bulk import and sync does not write products, jobs, or audit rows.

Production provider API calls and safe image download are intentionally fail-closed:

- With `SOURCE_IMPORT_USE_FAKE_PROVIDERS=False`, adapters report a configuration or
  not-implemented error instead of returning fake success.
- `image_mode=download` returns `IMAGE_VALIDATION_ERROR`; use `skip` or `remote`.
  Remote mode stores the URL only in `ProductSource.external_image_url`.
- Celery schedules/background workers are not configured in the current project yet.

## Local setup

```bash
cd web/backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

For local fake-provider development only:

```bash
export SOURCE_IMPORT_USE_FAKE_PROVIDERS=true
export USD_VND_RATE=25000
```

Run checks and tests (tests never call provider APIs or DNS):

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test product_sources -v 2
```

## REST examples

All endpoints require an authenticated Django admin/staff user.

```bash
curl -X POST http://localhost:8000/api/admin/products/import-source/preview/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.amazon.co.jp/dp/B07HG6S41K","category_id":1,"default_weight_kg":"0.30","image_mode":"skip"}'

curl -X POST http://localhost:8000/api/admin/products/import-source/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.qoo10.jp/item/123456789","category_id":1,"default_weight_kg":"0.30","image_mode":"remote","dry_run":false}'

curl -X POST http://localhost:8000/api/admin/products/AMZ-B07HG6S41K/sync-source/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"update_product_price":false,"update_stock":true,"dry_run":true}'

curl -X POST http://localhost:8000/api/admin/products/sync-sources/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"provider":"amazon_jp","limit":100,"dry_run":true}'
```

The management command is also dry-run by default:

```bash
python manage.py sync_source_products --provider amazon_jp --limit 20
python manage.py sync_source_products --provider amazon_jp --limit 20 --execute
```

## MCP local server

Create a dedicated active staff account once; MCP does not silently create users:

```bash
python manage.py createsuperuser --username mcp_system_user
python -m product_sources.mcp.server
```

Every non-dry-run MCP import/sync tool requires `confirmation=true`. Local stdio is
implemented; authenticated remote Streamable HTTP transport is not enabled yet.
