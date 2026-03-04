from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass
class ApplicantProfile:
    first_name: str
    last_name: str
    email: str
    phone: str
    location: str
    linkedin_url: str
    github_url: str
    portfolio_url: str
    work_authorization: str
    visa_sponsorship_required: bool
    school: str
    degree: str
    graduation_date: str
    resume_url: str
    resume_path: str
    cover_letter_path: str
    default_cover_letter_text: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _clean_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _clean_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)

    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes", "y"}:
        return True
    if normalized in {"false", "0", "no", "n"}:
        return False
    return default


def _expand_path(value: str) -> str:
    cleaned = _clean_string(value)
    if not cleaned:
        return ""
    return str(Path(cleaned).expanduser().resolve())


def _existing_path_or_empty(value: str) -> str:
    path_value = _expand_path(value)
    if not path_value:
        return ""
    return path_value if Path(path_value).exists() else ""


def _deep_get(data: Dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _load_json_file(profile_path: str) -> Dict[str, Any]:
    path = Path(profile_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Profile file not found: {path}")

    content = path.read_text(encoding="utf-8").strip()
    if not content:
        return {}

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError("Profile JSON must be an object at the top level.")
    return parsed


def _load_json_string(raw_json: str) -> Dict[str, Any]:
    content = raw_json.strip()
    if not content:
        return {}

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError("Inline profile JSON must be an object at the top level.")
    return parsed


def _env_profile_dict() -> Dict[str, Any]:
    return {
        "first_name": os.getenv("APPLY_AGENT_FIRST_NAME", "Lam Anh"),
        "last_name": os.getenv("APPLY_AGENT_LAST_NAME", "Truong"),
        "email": os.getenv("APPLY_AGENT_EMAIL", "npnallstar@gmail.com"),
        "phone": os.getenv("APPLY_AGENT_PHONE", "5514049519"),
        "location": os.getenv("APPLY_AGENT_LOCATION", ""),
        "linkedin_url": os.getenv("APPLY_AGENT_LINKEDIN_URL", ""),
        "github_url": os.getenv("APPLY_AGENT_GITHUB_URL", ""),
        "portfolio_url": os.getenv("APPLY_AGENT_PORTFOLIO_URL", ""),
        "work_authorization": os.getenv("APPLY_AGENT_WORK_AUTHORIZATION", ""),
        "visa_sponsorship_required": os.getenv(
            "APPLY_AGENT_VISA_SPONSORSHIP_REQUIRED",
            "",
        ),
        "school": os.getenv("APPLY_AGENT_SCHOOL", ""),
        "degree": os.getenv("APPLY_AGENT_DEGREE", ""),
        "graduation_date": os.getenv("APPLY_AGENT_GRADUATION_DATE", ""),
        "resume_url": os.getenv(
            "APPLY_AGENT_RESUME_URL",
            "https://drive.google.com/file/d/1wKb7hlbshHesim7XOc5pAx5dTjCptCdy/view?usp=sharing",
        ),
        "resume_path": os.getenv("APPLY_AGENT_RESUME_PATH", ""),
        "cover_letter_path": os.getenv("APPLY_AGENT_COVER_LETTER_PATH", ""),
        "default_cover_letter_text": os.getenv(
            "APPLY_AGENT_DEFAULT_COVER_LETTER_TEXT",
            """Hi there!
I am writing because I am genuinely obsessed with the idea of rebuilding business processes as "AI-native" rather than just slapping AI on top of old workflows. When I saw that is exactly what the Enterprise AI team at Flagship Pioneering is doing, I knew I had to reach out.
I love building things that solve real problems. Recently, I built a tool using DeepSeek and a RAG pipeline to turn natural language into SQL queries so staff could get real-time reports without needing to know how to code. I’ve also architected event-driven systems on the cloud that boosted efficiency by 80%. Whether it’s writing Python scripts, deploying on AWS, or using tools like Claude and Gemini to automate a manual mess, I am happiest when I’m making a process faster and smarter.
I am currently finishing my Master’s in Computer Science at George Mason University. While I have a strong technical background, I’m most excited about the "builder" aspect of this role—figuring out which tool fits the job and making sure it actually works reliably in the real world.
I am ready to be in Cambridge full-time this June to help the team invent new ways of working. I’d love to show you how my experience in AI and automation can help Flagship Pioneering continue to transform human health.
Best,
Lam Anh Truong
""",
        ),
    }


def _merge_profile_sources(
    env_data: Dict[str, Any],
    file_data: Optional[Dict[str, Any]] = None,
    inline_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    merged = dict(env_data)

    if file_data:
        merged.update(file_data)

    if inline_data:
        merged.update(inline_data)

    return merged


def normalize_applicant_profile(raw: Dict[str, Any]) -> ApplicantProfile:
    education = raw.get("education")
    if not isinstance(education, dict):
        education = {}

    links = raw.get("links")
    if not isinstance(links, dict):
        links = {}

    files = raw.get("files")
    if not isinstance(files, dict):
        files = {}

    def _looks_like_url(v: Any) -> bool:
        if not isinstance(v, str):
            return False
        s = v.strip().lower()
        return s.startswith("http://") or s.startswith("https://")

    resume_candidate = (
        raw.get("resume_path")
        or files.get("resume")
        or files.get("resume_path")
        or raw.get("resume")
        or ""
    )

    cover_letter_candidate = (
        raw.get("cover_letter_path")
        or files.get("cover_letter")
        or files.get("cover_letter_path")
        or raw.get("cover_letter")
        or ""
    )

    resume_url_candidate = (
        raw.get("resume_url")
        or links.get("resume")
        or files.get("resume_url")
        or raw.get("resume_link")
        or (raw.get("resume") if _looks_like_url(raw.get("resume")) else "")
        or ""
    )

    return ApplicantProfile(
        first_name=_clean_string(
            raw.get("first_name") or _deep_get(raw, "name", "first") or ""
        ),
        last_name=_clean_string(
            raw.get("last_name") or _deep_get(raw, "name", "last") or ""
        ),
        email=_clean_string(raw.get("email")),
        phone=_clean_string(raw.get("phone")),
        location=_clean_string(raw.get("location")),
        linkedin_url=_clean_string(
            raw.get("linkedin_url") or links.get("linkedin") or ""
        ),
        github_url=_clean_string(
            raw.get("github_url") or links.get("github") or ""
        ),
        portfolio_url=_clean_string(
            raw.get("portfolio_url") or links.get("portfolio") or ""
        ),
        work_authorization=_clean_string(raw.get("work_authorization")),
        visa_sponsorship_required=_clean_bool(
            raw.get("visa_sponsorship_required"),
            default=False,
        ),
        school=_clean_string(raw.get("school") or education.get("school") or ""),
        degree=_clean_string(raw.get("degree") or education.get("degree") or ""),
        graduation_date=_clean_string(
            raw.get("graduation_date") or education.get("graduation_date") or ""
        ),
        resume_url=_clean_string(resume_url_candidate),
        resume_path=_existing_path_or_empty(resume_candidate),
        cover_letter_path=_existing_path_or_empty(cover_letter_candidate),
        default_cover_letter_text=_clean_string(
            raw.get("default_cover_letter_text")
            or raw.get("cover_letter_text")
            or ""
        ),
    )


def load_applicant_profile(
    profile_path: Optional[str] = None,
    profile_json: Optional[str] = None,
) -> ApplicantProfile:
    env_data = _env_profile_dict()

    resolved_profile_path = (
        _clean_string(profile_path)
        or _clean_string(os.getenv("APPLY_AGENT_PROFILE_PATH"))
    )
    resolved_profile_json = (
        _clean_string(profile_json)
        or _clean_string(os.getenv("APPLY_AGENT_PROFILE_JSON"))
    )

    file_data: Optional[Dict[str, Any]] = None
    inline_data: Optional[Dict[str, Any]] = None

    if resolved_profile_path:
        file_data = _load_json_file(resolved_profile_path)

    if resolved_profile_json:
        inline_data = _load_json_string(resolved_profile_json)

    merged = _merge_profile_sources(
        env_data=env_data,
        file_data=file_data,
        inline_data=inline_data,
    )

    return normalize_applicant_profile(merged)


def load_applicant_profile_dict(
    profile_path: Optional[str] = None,
    profile_json: Optional[str] = None,
) -> Dict[str, Any]:
    return load_applicant_profile(
        profile_path=profile_path,
        profile_json=profile_json,
    ).to_dict()