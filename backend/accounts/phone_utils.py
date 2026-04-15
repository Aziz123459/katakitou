"""Comparaison de numéros de téléphone (espaces, +216, etc.)."""


def phone_digits(phone: str | None) -> str:
    if not phone:
        return ''
    return ''.join(c for c in str(phone).strip() if c.isdigit())


def phones_match(a: str | None, b: str | None) -> bool:
    da = phone_digits(a)
    db = phone_digits(b)
    if not da or not db:
        return False
    return da == db


def find_profile_by_phone(phone: str):
    """Retourne le UserProfile dont le numéro correspond (chiffres uniquement)."""
    from accounts.models import UserProfile

    want = phone_digits(phone)
    if not want:
        return None
    for p in UserProfile.objects.select_related('user').iterator():
        if phone_digits(p.phone) == want:
            return p
    return None
