"""In-memory rate limiter (slowapi). Fine for a single-instance MVP;
swap the storage_uri for Redis when scaling horizontally."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
