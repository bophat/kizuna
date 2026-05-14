# Findings & Decisions

## Requirements
- Refactor Admin interface using React.
- Create Python API for the Admin interface (Django/DRF).
- Shared database with the website (website/backend/db.sqlite3).
- Standardize Logo and Header consistency (spacing, alignment).
- Fix 400 Bad Request at `/api/shop/checkout/process_checkout/`.
- Automate checkout fields (email, name, phone, address) from user profile.
- Implement Audit Logging and 2FA (Settings module).
- Maintain "Modern Japanese" design aesthetic.

## Research Findings
- `Header.tsx` has a separate render block for `isCheckout` which might be causing the logo discrepancy.
- Both standard and checkout headers use `max-w-[1280px] mx-auto px-8 h-20`.
- The logo block is repeated twice in `Header.tsx`.
- `Checkout.tsx` fetches user data from `/shop/me/` but still requires manual entry if the fields aren't pre-filled correctly or if the form doesn't handle them well.
- `process_checkout` in `shop/views.py` returns a 400 if `email` is missing in the payload.
- Bank Transfer Details in `Checkout.tsx` use `max-w-3xl`, which might feel "narrow" to the user.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Unify Logo/Header structure in `Header.tsx` | Ensure identical spacing and look across all modes. |
| Use `request.user` fields in `process_checkout` | Fallback to authenticated user info if frontend payload is missing some fields. |
| Expand Bank Transfer Details card | Address the "cut narrow" feedback by increasing `max-w` or removing it for better responsiveness. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 400 Bad Request on Checkout | Likely due to missing email in payload or empty cart. |
| ERR_CONNECTION_REFUSED | Backend server (port 8000) not running. |
| Logo discrepancy | `Header.tsx` has redundant logo code. |

## Resources
- Header Component: `web/website/src/components/layout/Header.tsx`
- Checkout Page: `web/website/src/pages/Checkout.tsx`
- Backend Views: `web/website/backend/shop/views.py`

## Visual/Browser Findings
- User reported Logo misalignment and spacing issues on Checkout page.
- User requested "Bank Transfer Details" to be styled as a centered card.
- Checkout page requires email input even when logged in (to be fixed).

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
