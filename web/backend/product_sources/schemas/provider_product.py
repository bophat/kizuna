from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class ProviderImage(BaseModel):
    url: HttpUrl
    is_primary: bool = False
    sort_order: int = 0


class ProviderProduct(BaseModel):
    provider: str
    source_product_id: str
    canonical_url: HttpUrl
    affiliate_url: HttpUrl | None = None

    name: str = Field(min_length=1, max_length=500)
    brand: str | None = None
    seller: str | None = None
    source_category: str | None = None
    jan_code: str | None = None

    source_price: Decimal | None = None
    source_currency: str = 'JPY'
    availability: Literal['available', 'unavailable', 'unknown'] = 'unknown'
    stock_quantity: int | None = None
    weight_kg: Decimal | None = None

    description_facts: list[str] = Field(default_factory=list)
    images: list[ProviderImage] = Field(default_factory=list)

    fetched_at: datetime
    expires_at: datetime | None = None
    raw_data: dict = Field(default_factory=dict)

    @field_validator('source_price')
    @classmethod
    def price_non_negative(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError('source_price must be >= 0')
        return v
