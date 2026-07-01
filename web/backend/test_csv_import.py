import os
import sys
import django
import io
import csv
from decimal import Decimal

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from admin_api.views import BulkImportProductsView
from shop.models import Product, Category, ProductImage

def run_test():
    csv_path = '/Users/phattdt/Desktop/phat/myprj-AIv2/qoo10_2026-06-02 (3).csv'
    print(f"Reading CSV from: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    # We can test how BulkImportProductsView parses it
    view = BulkImportProductsView()
    reader = csv.DictReader(io.StringIO(content))
    
    print("Columns in CSV:", reader.fieldnames)
    
    for idx, row in enumerate(reader, start=2):
        print(f"\n--- Row {idx} ---")
        name = (row.get('name') or row.get('Name') or '').strip()
        brand = (row.get('brand') or row.get('Brand') or row.get('seller') or row.get('Seller') or '').strip()
        sku = (row.get('sku') or row.get('SKU') or '').strip()
        original_price = row.get('originalPrice') or row.get('Original Price') or ''
        price = row.get('price') or row.get('Price') or ''
        
        print(f"Name: {repr(name)}")
        print(f"Brand: {repr(brand)}")
        print(f"SKU: {repr(sku)}")
        print(f"Original Price: {repr(original_price)}")
        print(f"Price: {repr(price)}")
        
        parsed_jpy = view._parse_jpy_price(
            row.get('originalPrice') or row.get('Original Price') or 
            row.get('price') or row.get('Price', '')
        )
        print(f"Parsed JPY JPY: {parsed_jpy}")

if __name__ == '__main__':
    run_test()
