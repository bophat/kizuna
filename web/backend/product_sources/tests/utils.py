import ipaddress
import socket


def deterministic_public_dns(host: str, port, *args, **kwargs):
    """Offline resolver used by tests while preserving private-IP checks."""
    try:
        ipaddress.ip_address(host)
        resolved_ip = host
    except ValueError:
        resolved_ip = '8.8.8.8'
    return [
        (
            socket.AF_INET,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
            '',
            (resolved_ip, port or 0),
        ),
    ]
