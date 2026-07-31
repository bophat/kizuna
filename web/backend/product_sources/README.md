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

Production provider API calls are implemented. When credentials are present,
the authorized API remains the preferred data source:

- Amazon Japan uses Amazon Creators API `GetItems`. PA-API access keys are not
  supported. Configure `AMAZON_CREATORS_CREDENTIAL_ID`,
  `AMAZON_CREATORS_CREDENTIAL_SECRET`, `AMAZON_CREATORS_CREDENTIAL_VERSION`
  (`2.3` or `3.3`), and `AMAZON_JP_PARTNER_TAG`.
- Qoo10 Japan uses QAPI `ItemsLookup.GetItemDetailInfo` v1.2. Configure
  `QOO10_CERTIFICATION_KEY`; the key is sent in the
  `GiosisCertificationKey` header and is never added to the request URL.
- OAuth tokens are cached, transient network/5xx responses are retried, and
  provider auth/permission/rate-limit/not-found errors are mapped to stable
  source-import errors.
- With no provider credentials, `SOURCE_IMPORT_PUBLIC_PAGE_FALLBACK_ENABLED=true`
  reads public JSON-LD/OpenGraph and product-page fields. It does not log in, use
  browser cookies, solve CAPTCHA, or bypass marketplace access controls. Preview
  reports that the public-page fallback was used. A blocked/changed page returns
  a clear provider error instead of fake data.
- Public-page results are cached for 15 minutes by default so preview followed by
  import does not normally download the same page twice. Configure the limits
  with `SOURCE_IMPORT_PUBLIC_PAGE_MAX_BYTES`,
  `SOURCE_IMPORT_PUBLIC_PAGE_TIMEOUT_SECONDS`,
  `SOURCE_IMPORT_PUBLIC_PAGE_MAX_REDIRECTS`, and
  `SOURCE_IMPORT_PUBLIC_PAGE_CACHE_SECONDS`.
- Partially configured or invalid API credentials still fail closed instead of
  silently switching data sources.
- Celery schedules/background workers are not configured in the current project yet.

Safe image download is implemented but disabled by default for compliance:

- `remote` stores the provider URL in `ProductSource.external_image_url`.
- `download` first validates the hostname and every redirect against the SSRF
  whitelist, limits download bytes and pixels, verifies MIME against image magic
  bytes, accepts JPEG/PNG/WebP only, and then stores the image through Django
  storage. The original provider URL is retained as source metadata.
- Enable `SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED=true` only when you have permission
  to store and redistribute the provider image. Otherwise `download` fails closed
  with `IMAGE_VALIDATION_ERROR`.
- Optional limits are `SOURCE_IMPORT_IMAGE_MAX_BYTES`,
  `SOURCE_IMPORT_IMAGE_MAX_PIXELS`, `SOURCE_IMPORT_IMAGE_TIMEOUT_SECONDS`, and
  `SOURCE_IMPORT_IMAGE_MAX_REDIRECTS`.

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

The Admin inventory screen also has **Import URL**: paste up to 50 Amazon
JP/Qoo10 JP product URLs, select the target category, and preview all normalized
products before importing. The preview uses the storefront's card/detail layout
and price formatter. You can deselect individual products before confirming.
Imported products always start as `draft`.

When a marketplace blocks its public page, **Manual import** remains the fallback.
It accepts up to 50 manually entered source URLs and product payloads, calculates
prices with `ProductPricingService`, renders the same storefront preview, and
stores selected products with provider `manual` and status `draft`.

```bash
curl -X POST http://localhost:8000/api/admin/products/import-manual/preview/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"source_url":"https://www.amazon.co.jp/dp/B07HG6S41K","sku":"MANUAL-001","name":"Manual product","source_price_jpy":"3980","category_id":1,"weight_kg":"0.30","stock":1}],"image_mode":"remote"}'

curl -X POST http://localhost:8000/api/admin/products/import-manual/bulk/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"source_url":"https://www.amazon.co.jp/dp/B07HG6S41K","sku":"MANUAL-001","name":"Manual product","source_price_jpy":"3980","category_id":1,"weight_kg":"0.30","stock":1}],"image_mode":"remote"}'
```

```bash
curl -X POST http://localhost:8000/api/admin/products/import-source/preview/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.amazon.co.jp/dp/B07HG6S41K","category_id":1,"default_weight_kg":"0.30","image_mode":"skip"}'

curl -X POST http://localhost:8000/api/admin/products/import-source/ \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.qoo10.jp/item/123456789","category_id":1,"default_weight_kg":"0.30","image_mode":"download","dry_run":false}'

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
