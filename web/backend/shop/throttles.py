from rest_framework.throttling import AnonRateThrottle


class ConciergeRateThrottle(AnonRateThrottle):
    scope = 'concierge'
