from decimal import Decimal

from pydantic import BaseModel, Field

from product_sources.enums import ImageMode


class PreviewImportRequest(BaseModel):
    url: str
    category_id: int | None = None
    default_weight_kg: Decimal | None = Field(default=Decimal('0.30'), ge=0)
    default_stock: int = Field(default=1, ge=0)
    image_mode: ImageMode = ImageMode.SKIP


class ImportSourceProductRequest(PreviewImportRequest):
    dry_run: bool = False


class BulkImportRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=50)
    category_id: int | None = None
    default_weight_kg: Decimal | None = Field(default=Decimal('0.30'), ge=0)
    default_stock: int = Field(default=1, ge=0)
    image_mode: ImageMode = ImageMode.SKIP
    dry_run: bool = True


class SyncSourceRequest(BaseModel):
    update_product_price: bool = False
    update_stock: bool = True
    dry_run: bool = True


class BulkSyncRequest(BaseModel):
    provider: str | None = None
    product_ids: list[str] = Field(default_factory=list)
    limit: int = Field(default=100, ge=1, le=1000)
    update_product_price: bool = False
    update_stock: bool = True
    dry_run: bool = True
