from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from .profile_loader import ApplicantProfile


@dataclass(frozen=True)
class FieldMappingResult:
    field_name: str
    label: str
    field_type: str
    required: bool
    selector: str
    value: Any
    source: str
    should_fill: bool


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _normalize_key(value: str) -> str:
    normalized = _normalize_text(value).lower()
    normalized = normalized.replace("-", "_")
    normalized = normalized.replace(" ", "_")
    normalized = normalized.replace("/", "_")
    normalized = normalized.replace(".", "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    return any(term in text for term in terms)


def _profile_value(profile: ApplicantProfile, attr: str) -> Any:
    return getattr(profile, attr, "")


def _match_profile_attribute(field_name: str, label: str) -> Optional[str]:
    name_key = _normalize_key(field_name)
    label_key = _normalize_key(label)

    combined = f"{name_key} {label_key}".strip()

    rules = [
        (
            (
                "first_name",
                "firstname",
                "given_name",
                "givenname",
                "legal_first_name",
            ),
            "first_name",
        ),
        (
            (
                "last_name",
                "lastname",
                "family_name",
                "surname",
                "legal_last_name",
            ),
            "last_name",
        ),
        (
            (
                "full_name",
                "name",
                "legal_name",
            ),
            "__full_name__",
        ),
        (
            (
                "email",
                "email_address",
            ),
            "email",
        ),
        (
            (
                "phone",
                "phone_number",
                "mobile",
                "mobile_phone",
                "telephone",
            ),
            "phone",
        ),
        (
            (
                "location",
                "city_state",
                "address_city",
                "current_location",
            ),
            "location",
        ),
        (
            (
                "linkedin",
                "linkedin_url",
                "linkedin_profile",
            ),
            "linkedin_url",
        ),
        (
            (
                "github",
                "github_url",
                "github_profile",
            ),
            "github_url",
        ),
        (
            (
                "portfolio",
                "portfolio_url",
                "website",
                "personal_website",
                "homepage",
                "link",
            ),
            "portfolio_url",
        ),
        (
            (
                "work_authorization",
                "work_auth",
                "authorized_to_work",
                "employment_authorization",
            ),
            "work_authorization",
        ),
        (
            (
                "visa_sponsorship",
                "requires_sponsorship",
                "sponsorship_required",
            ),
            "visa_sponsorship_required",
        ),
        (
            (
                "school",
                "university",
                "college",
                "institution",
            ),
            "school",
        ),
        (
            (
                "degree",
                "major_degree",
                "education_degree",
            ),
            "degree",
        ),
        (
            (
                "graduation_date",
                "grad_date",
                "expected_graduation",
                "graduation",
            ),
            "graduation_date",
        ),
        (
            (
                "enter_manually",
                "manual_resume",
                "resume_link",
                "resume_url",
                "resume_manual",
                "resume_manual_url",
            ),
            "resume_url",
        ),
        (
            (
                "resume",
                "resume_file",
                "resume_cv",
                "resume_cv_file",
                "cv",
                "cv_file",
            ),
            "resume_path",
        ),
        (
            (
                "cover_letter",
                "coverletter",
                "cover_letter_text",
            ),
            "cover_letter_text",
        ),
        (
            (
                "cover_letter_file",
            ),
            "cover_letter_path",
        ),
    ]

    for aliases, attr in rules:
        if _contains_any(combined, aliases):
            return attr

    return None


def _derive_special_value(profile: ApplicantProfile, special_key: str) -> Any:
    if special_key == "__full_name__":
        full_name = f"{profile.first_name} {profile.last_name}".strip()
        return full_name
    return ""


def _coerce_value_for_field(value: Any, field_type: str) -> Any:
    normalized_type = _normalize_key(field_type)

    if normalized_type in {"checkbox", "boolean", "bool"}:
        if isinstance(value, bool):
            return value
        text = _normalize_text(value).lower()
        if text in {"true", "yes", "1", "y"}:
            return True
        if text in {"false", "no", "0", "n"}:
            return False
        return False

    if normalized_type in {"file", "upload"}:
        return _normalize_text(value)

    return _normalize_text(value)


def _build_result(
    *,
    field_name: str,
    label: str,
    field_type: str,
    required: bool,
    selector: str,
    value: Any,
    source: str,
) -> FieldMappingResult:
    normalized_type = _normalize_key(field_type)

    if normalized_type in {"file", "upload"}:
        should_fill = bool(_normalize_text(value))
    elif normalized_type in {"checkbox", "boolean", "bool"}:
        should_fill = True
    else:
        should_fill = bool(_normalize_text(value))

    return FieldMappingResult(
        field_name=field_name,
        label=label,
        field_type=field_type,
        required=required,
        selector=selector,
        value=value,
        source=source,
        should_fill=should_fill,
    )


def map_visible_fields_to_profile(
    *,
    profile: ApplicantProfile,
    visible_fields: List[Dict[str, Any]],
) -> List[FieldMappingResult]:
    mapped: List[FieldMappingResult] = []

    for field in visible_fields:
        field_name = _normalize_text(field.get("name"))
        label = _normalize_text(field.get("label"))
        field_type = _normalize_text(field.get("type")) or "text"
        selector = _normalize_text(field.get("selector"))
        required = bool(field.get("required", False))

        field_name_key = _normalize_key(field_name)
        label_key = _normalize_key(label)
        combined_key = f"{field_name_key} {label_key}".strip()

        if _contains_any(
            combined_key,
            (
                "enter_manually",
                "manual_resume",
                "resume_link",
                "resume_url",
                "resume_manual",
                "resume_manual_url",
            ),
        ):
            matched_attr = "resume_url"
        elif _contains_any(
            combined_key,
            (
                "cover_letter",
                "coverletter",
            ),
        ) and _normalize_key(field_type) not in {"file", "upload"}:
            matched_attr = "cover_letter_text"
        elif _contains_any(
            combined_key,
            (
                "portfolio",
                "portfolio_url",
                "website",
                "personal_website",
                "homepage",
                "link",
            ),
        ) and _contains_any(
            combined_key,
            (
                "resume",
                "cv",
            ),
        ):
            matched_attr = "resume_url"
        else:
            matched_attr = _match_profile_attribute(field_name, label)

        if matched_attr is None:
            mapped.append(
                _build_result(
                    field_name=field_name,
                    label=label,
                    field_type=field_type,
                    required=required,
                    selector=selector,
                    value="",
                    source="unmapped",
                )
            )
            continue

        if matched_attr.startswith("__"):
            raw_value = _derive_special_value(profile, matched_attr)
            source = "derived"
        else:
            raw_value = _profile_value(profile, matched_attr)
            source = matched_attr

        coerced_value = _coerce_value_for_field(raw_value, field_type)

        mapped.append(
            _build_result(
                field_name=field_name,
                label=label,
                field_type=field_type,
                required=required,
                selector=selector,
                value=coerced_value,
                source=source,
            )
        )

    return mapped


def mapping_results_to_dicts(
    results: List[FieldMappingResult],
) -> List[Dict[str, Any]]:
    return [
        {
            "field_name": item.field_name,
            "label": item.label,
            "field_type": item.field_type,
            "required": item.required,
            "selector": item.selector,
            "value": item.value,
            "source": item.source,
            "should_fill": item.should_fill,
        }
        for item in results
    ]


def build_provider_payload(
    *,
    profile: ApplicantProfile,
    visible_fields: List[Dict[str, Any]],
    provider: str,
) -> Dict[str, Any]:
    mappings = map_visible_fields_to_profile(
        profile=profile,
        visible_fields=visible_fields,
    )

    provider_key = _normalize_key(provider)

    payload: Dict[str, Any] = {
        "provider": provider_key,
        "fields": mapping_results_to_dicts(mappings),
        "required_field_count": sum(1 for item in mappings if item.required),
        "fillable_field_count": sum(1 for item in mappings if item.should_fill),
    }

    if provider_key == "greenhouse":
        payload["supports_resume_autofill"] = True
        payload["prefers_resume_upload_first"] = True
        payload["supports_manual_resume_url"] = True
    elif provider_key == "ashby":
        payload["supports_resume_autofill"] = True
        payload["prefers_resume_upload_first"] = True
        payload["supports_manual_resume_url"] = True
    elif provider_key == "workday":
        payload["supports_resume_autofill"] = True
        payload["prefers_resume_upload_first"] = False
        payload["supports_manual_resume_url"] = True
    else:
        payload["supports_resume_autofill"] = False
        payload["prefers_resume_upload_first"] = False
        payload["supports_manual_resume_url"] = False

    return payload