from .ashby import AshbyProviderAdapter
from .base import BaseProviderAdapter, ProviderName
from .greenhouse import GreenhouseProviderAdapter
from .workday import WorkdayProviderAdapter


def get_provider_adapter(provider: ProviderName) -> BaseProviderAdapter:
    if provider == "greenhouse":
        return GreenhouseProviderAdapter()

    if provider == "ashby":
        return AshbyProviderAdapter()

    if provider == "workday":
        return WorkdayProviderAdapter()

    return BaseProviderAdapter()