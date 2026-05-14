from chatbot import generate_reply, search_product_japan

user_input = "Tìm giúp mình giá iPhone 15 Pro Max tại Nhật"
reply, missing_products = generate_reply(user_input)
print("REPLY:", reply)
print("MISSING PRODUCTS:", missing_products)

if missing_products:
    for product in missing_products:
        print("Searching for:", product)
        temp_price_info, price_jpy, price_vnd = search_product_japan(product)
        print("Result:", temp_price_info, price_jpy, price_vnd)

