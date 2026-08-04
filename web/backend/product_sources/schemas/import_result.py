from pydantic import BaseModel, Field


class ProductPayloadPreview(BaseModel):
    id: str
    name: str
    price: str
    currency: str = 'USD'
    category: int | None = None
    stock: int = 1
    description: str
    brand: str | None = None
    location: str | None = None
    weight: str | None = None
    is_new: bool = True
    status: str = 'draft'


class SourcePreviewInfo(BaseModel):
    source_price: str | None = None
    source_currency: str = 'JPY'
    source_price_jpy: str | None = None
    availability: str = 'unknown'
    images: list[str] = Field(default_factory=list)


class PricingPreview(BaseModel):
    source_price_vnd: str
    import_cost_vnd: str
    shipping_vnd: str
    selling_price_vnd: str
    selling_price_usd: str
    calculation_snapshot: dict = Field(default_factory=dict)


class ImportPreview(BaseModel):
    provider: str
    source_product_id: str
    canonical_url: str
    duplicate: bool = False
    category_required: bool = False
    product_payload: ProductPayloadPreview
    source: SourcePreviewInfo
    pricing: PricingPreview | None = None
    warnings: list[str] = Field(default_factory=list)


class ImportResult(BaseModel):
    success: bool
    product_id: str | None = None
    source_id: int | None = None
    status: str | None = None
    warnings: list[str] = Field(default_factory=list)
    dry_run: bool = False
    preview: ImportPreview | None = None


class BulkImportItemResult(BaseModel):
    url: str
    success: bool
    product_id: str | None = None
    source_id: int | None = None
    preview: dict | None = None
    error_code: str | None = None
    message: str | None = None


class BulkImportResult(BaseModel):
    job_id: int | None = None
    dry_run: bool
    total: int
    succeeded: int
    failed: int
    items: list[BulkImportItemResult]
