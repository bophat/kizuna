"""Cart ownership for signed-in customers and guests.

A cart belongs either to a User or to an anonymous browser session. Guests are
identified by Django's session key, which rides on the same credentialed
requests the JWT auth cookies already use, so the storefront does not have to
mint or store an identifier of its own.
"""

from .models import Cart, CartItem


def ensure_session_key(request):
    """Return the session key, starting a session for a first-time guest."""
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


def get_cart(request, create=False):
    """Resolve the cart for this request, or None when there isn't one yet."""
    if request.user.is_authenticated:
        if create:
            cart, _ = Cart.objects.get_or_create(user=request.user)
            return cart
        return Cart.objects.filter(user=request.user).first()

    session_key = request.session.session_key
    if not session_key:
        if not create:
            return None
        session_key = ensure_session_key(request)
    if create:
        cart, _ = Cart.objects.get_or_create(user=None, session_id=session_key)
        return cart
    return Cart.objects.filter(user=None, session_id=session_key).first()


def merge_guest_cart(request, user):
    """Fold a guest cart into the user's cart when they sign in or register.

    Quantities are added together for products present in both. The guest cart
    is deleted afterwards so a later session cannot resurrect it.
    """
    session_key = request.session.session_key
    if not session_key:
        return

    guest_cart = Cart.objects.filter(user=None, session_id=session_key).first()
    if not guest_cart:
        return

    guest_items = list(guest_cart.items.all())
    if not guest_items:
        guest_cart.delete()
        return

    user_cart, _ = Cart.objects.get_or_create(user=user)
    for guest_item in guest_items:
        existing = CartItem.objects.filter(
            cart=user_cart, product_id=guest_item.product_id
        ).first()
        if existing:
            existing.quantity += guest_item.quantity
            existing.save(update_fields=['quantity'])
        else:
            CartItem.objects.create(
                cart=user_cart,
                product_id=guest_item.product_id,
                quantity=guest_item.quantity,
                price=guest_item.price,
            )
    guest_cart.delete()
