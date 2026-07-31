from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl, field_validator

from product_sources.enums import ImageMode


class ManualProductInput(BaseModel):
    source_url: HttpUrl
    sku: str | None = Field(default=None, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=10_000)
    source_price_jpy: Decimal = Field(ge=0)
    category_id: int = Field(gt=0)
    weight_kg: Decimal = Field(default=Decimal('0.30'), ge=0)
    stock: int = Field(default=1, ge=0)
    brand: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default='Japan', max_length=100)
    image_url: HttpUrl | None = None
    is_new: bool = True
    is_limited: bool = False
    is_featured: bool = False
    is_cheap: bool = False

    @field_validator('sku', 'brand', 'location', mode='before')
    @classmethod
    def empty_string_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator('name', 'description', mode='before')
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class ManualBulkRequest(BaseModel):
    items: list[ManualProductInput] = Field(min_length=1, max_length=50)
    image_mode: ImageMode = ImageMode.REMOTE
