import requests

BASE_URL = "http://127.0.0.1:8000/api"

def test_api():
    print("--- 1. Registering user ---")
    reg_data = {
        "username": "tester",
        "password": "password123",
        "email": "tester@example.com"
    }
    r = requests.post(f"{BASE_URL}/register/", json=reg_data)
    print(r.status_code, r.json())

    print("\n--- 2. Logging in ---")
    login_data = {
        "username": "tester",
        "password": "password123"
    }
    r = requests.post(f"{BASE_URL}/login/", json=login_data)
    token = r.json().get("access")
    print(r.status_code, "Token received" if token else "No token")

    if token:
        headers = {"Authorization": f"Bearer {token}"}
        
        print("\n--- 3. Getting profile ---")
        r = requests.get(f"{BASE_URL}/me/", headers=headers)
        print(r.status_code, r.json())

        print("\n--- 4. Listing roles ---")
        r = requests.get(f"{BASE_URL}/roles/", headers=headers)
        print(r.status_code, r.json())

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"Error: {e}. Make sure the server is running at {BASE_URL}")
