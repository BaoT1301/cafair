from .providers.ashby import AshbyProviderAdapter
from .providers.base import BaseProviderAdapter, ProviderName
from .providers.greenhouse import GreenhouseProviderAdapter
from .providers.workday import WorkdayProviderAdapter


def get_provider_adapter(provider: ProviderName) -> BaseProviderAdapter:
    if provider == "greenhouse":
        return GreenhouseProviderAdapter()

    if provider == "ashby":
        return AshbyProviderAdapter()

    if provider == "workday":
        return WorkdayProviderAdapter()

    return BaseProviderAdapter()