"""
RUSH HOUR BET Services Package
Includes SmartFeedAgent for global traffic camera discovery, content filtering,
quality scoring, 30s health monitoring, <2s emergency failover, and load balancing.
"""

from services.smart_feed_agent import (
    SmartFeedAgent,
    smart_feed_agent,
    GLOBAL_CITIES_DATA,
    get_global_cities,
    get_city_info,
)

__all__ = [
    "SmartFeedAgent",
    "smart_feed_agent",
    "GLOBAL_CITIES_DATA",
    "get_global_cities",
    "get_city_info",
]
