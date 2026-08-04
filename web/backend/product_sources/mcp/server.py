# ruff: noqa: E402

import os
import sys

# Ensure backend directory is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Initialize Django before importing models or services
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from decimal import Decimal
from django.conf import settings
from django.contrib.auth import get_user_model
from mcp.server.fastmcp import FastMCP

from product_sources.enums import ImageMode
from product_sources.schemas.import_request import BulkImportRequest, ImportSourceProductRequest, PreviewImportRequest
from product_sources.services.import_service import SourceImportService
from product_sources.services.sync_service import SyncService
from product_sources.services.pricing_service import ProductPricingService
from product_sources.selectors import source_products_needing_review

User = get_user_model()

# Create FastMCP server
mcp = FastMCP("commerce-source-mcp")


def get_mcp_user():
    """Resolve the pre-created Django staff account used for MCP write audit logs."""
    username = settings.MCP_SYSTEM_USERNAME
    try:
        user = User.objects.get(username=username, is_active=True, is_staff=True)
    except User.DoesNotExist as exc:
        raise PermissionError(
            f'MCP system user "{username}" does not exist or is not active staff.',
        ) from exc
    return user


@mcp.tool()
def preview_source_product(
    url: str,
    category_id: int | None = None,
    default_weight_kg: str = "0.30",
    default_stock: int = 1,
    image_mode: str = "skip",
) -> dict:
    """
    Preview product information and calculated selling price from a source URL.
    """
    request = PreviewImportRequest(
        url=url,
        category_id=category_id,
        default_weight_kg=Decimal(default_weight_kg),
        default_stock=default_stock,
        image_mode=ImageMode(image_mode),
    )
    service = SourceImportService()
    preview = service.preview(request)
    return preview.model_dump(mode="json")


@mcp.tool()
def import_source_product(
    url: str,
    category_id: int | None = None,
    default_weight_kg: str = "0.30",
    default_stock: int = 1,
    image_mode: str = "skip",
    dry_run: bool = False,
    confirmation: bool = False,
) -> dict:
    """
    Import a single product from a source URL. Requires confirmation=True if dry_run=False.
    """
    if not dry_run and not confirmation:
        return {"success": False, "error": "Yêu cầu confirmation=true để thực hiện import thật."}

    request = ImportSourceProductRequest(
        url=url,
        category_id=category_id,
        default_weight_kg=Decimal(default_weight_kg),
        default_stock=default_stock,
        image_mode=ImageMode(image_mode),
        dry_run=dry_run,
    )
    service = SourceImportService()
    user = None if dry_run else get_mcp_user()
    result = service.import_product(request, user)
    return result.model_dump(mode="json")


@mcp.tool()
def bulk_import_source_products(
    urls: list[str],
    category_id: int | None = None,
    default_weight_kg: str = "0.30",
    default_stock: int = 1,
    image_mode: str = "skip",
    dry_run: bool = True,
    confirmation: bool = False,
) -> dict:
    """
    Bulk import multiple products from a list of URLs. Requires confirmation=True if dry_run=False.
    """
    if not dry_run and not confirmation:
        return {"success": False, "error": "Yêu cầu confirmation=true để thực hiện bulk import thật."}

    request = BulkImportRequest(
        urls=urls,
        category_id=category_id,
        default_weight_kg=Decimal(default_weight_kg),
        default_stock=default_stock,
        image_mode=ImageMode(image_mode),
        dry_run=dry_run,
    )
    service = SourceImportService()
    user = None if dry_run else get_mcp_user()
    result = service.bulk_import(request, user)
    return result.model_dump(mode="json")


@mcp.tool()
def sync_source_product(
    product_id: str,
    update_product_price: bool = False,
    update_stock: bool = True,
    dry_run: bool = True,
    confirmation: bool = False,
) -> dict:
    """
    Synchronize a single source product with fresh data from marketplace. Requires confirmation=True if dry_run=False.
    """
    if not dry_run and not confirmation:
        return {"success": False, "error": "Yêu cầu confirmation=true để thực hiện sync thật."}

    service = SyncService()
    result = service.sync_product(
        product_id=product_id,
        update_product_price=update_product_price,
        update_stock=update_stock,
        dry_run=dry_run,
        actor=None if dry_run else get_mcp_user(),
    )
    return result


@mcp.tool()
def calculate_product_price(
    source_price_jpy: str,
    weight_kg: str,
    usd_vnd_rate: str = "25500",
    source_currency: str = "JPY",
) -> dict:
    """
    Convert a JPY, USD or VND source price to VND and calculate the selling price.
    """
    pricing_service = ProductPricingService()
    res = pricing_service.calculate(
        source_price_jpy=Decimal(source_price_jpy),
        source_currency=source_currency,
        weight_kg=Decimal(weight_kg),
        usd_vnd_rate=Decimal(usd_vnd_rate),
    )
    return {
        "source_price_jpy": str(res.source_price_jpy),
        "source_currency": res.source_currency,
        "source_price_vnd": str(res.source_price_vnd),
        "import_cost_vnd": str(res.import_cost_vnd),
        "shipping_vnd": str(res.shipping_vnd),
        "selling_price_vnd": str(res.selling_price_vnd),
        "selling_price_usd": str(res.selling_price_usd),
        "calculation_snapshot": res.calculation_snapshot,
    }


@mcp.tool()
def find_source_products_needing_review() -> list[dict]:
    """
    Retrieve products that need review (e.g. sync failures, status is REVIEW or SUSPENDED, stale sync status).
    """
    results = []
    for s in source_products_needing_review():
        results.append({
            "product_id": s.product.id,
            "product_name": s.product.name,
            "product_status": s.product.status,
            "provider": s.provider,
            "source_product_id": s.source_product_id,
            "sync_status": s.sync_status,
            "last_synced_at": s.last_synced_at.isoformat() if s.last_synced_at else None,
            "last_error": s.last_error,
        })
    return results


@mcp.tool()
def generate_import_csv(urls: list[str]) -> str:
    """
    Generate an import CSV string matching the catalog format for a list of URLs.
    """
    import io
    import csv

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "provider", "source_product_id", "url", "sku", "name", "originalPrice",
        "weight", "category", "category_id", "brand", "shipping", "mainImage",
        "All Images", "stock"
    ])
    for url in urls:
        writer.writerow(["", "", url, "", "", "", "", "", "", "", "", "", "", ""])
    return output.getvalue()


if __name__ == "__main__":
    mcp.run()
