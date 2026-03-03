#!/usr/bin/env python3
"""
python apps/llm/agents/scripts/run-social-screen-public-page.py --slow-mo 500 --pretty

run-social-screen-public-page.py

Recruiter-style visible browser review for a public portfolio site.

Primary target:
- https://lamanhtruong.com

Flow:
1. Open candidate portfolio
2. Review top-level page like a recruiter
3. Dive deeply into Projects
4. Open project cards one by one, inspect details, return
5. Open Resume
6. Open GitHub
7. On GitHub: inspect profile + repositories + open several repos
8. Return to portfolio
9. Click Retro
10. Perform 10 more recruiter-style inspection steps
11. Stop

This uses Playwright directly for reliability and visibility.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)

DEFAULT_URL = "https://lamanhtruong.com"


# =========================================================
# Logging helpers
# =========================================================

def log(msg: str) -> None:
    print(f"[INFO] {msg}", file=sys.stderr)


def warn(msg: str) -> None:
    print(f"[WARN] {msg}", file=sys.stderr)


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def short_text(value: Optional[str], max_len: int = 260) -> str:
    text = clean_text(value)
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def safe_wait(page: Page, ms: int = 800) -> None:
    try:
        page.wait_for_timeout(ms)
    except Exception:
        pass


# =========================================================
# Browser helpers
# =========================================================

def current_url(page: Page) -> str:
    try:
        return page.url
    except Exception:
        return ""


def page_title(page: Page) -> str:
    try:
        return clean_text(page.title())
    except Exception:
        return ""


def wait_dom(page: Page, timeout: int = 15000) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except Exception:
        pass


def smooth_scroll_down(page: Page, steps: int = 5, pixels: int = 700, pause_ms: int = 700) -> None:
    for _ in range(max(1, steps)):
        try:
            page.mouse.wheel(0, pixels)
        except Exception:
            try:
                page.evaluate(f"window.scrollBy(0, {pixels})")
            except Exception:
                pass
        safe_wait(page, pause_ms)


def smooth_scroll_up(page: Page, steps: int = 3, pixels: int = 600, pause_ms: int = 700) -> None:
    for _ in range(max(1, steps)):
        try:
            page.mouse.wheel(0, -pixels)
        except Exception:
            try:
                page.evaluate(f"window.scrollBy(0, {-pixels})")
            except Exception:
                pass
        safe_wait(page, pause_ms)


def scroll_to_top(page: Page) -> None:
    try:
        page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        safe_wait(page, 1200)
    except Exception:
        pass


def scroll_to_bottom(page: Page) -> None:
    try:
        page.evaluate("window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })")
        safe_wait(page, 1500)
    except Exception:
        pass


def body_preview(page: Page, max_len: int = 1800) -> str:
    try:
        return short_text(page.locator("body").inner_text(), max_len)
    except Exception:
        return ""


def open_popup_if_any(context: BrowserContext, before_count: int, timeout_ms: int = 2500) -> Optional[Page]:
    end = time.time() + (timeout_ms / 1000.0)
    while time.time() < end:
        pages = context.pages
        if len(pages) > before_count:
            popup = pages[-1]
            wait_dom(popup, 10000)
            safe_wait(popup, 1200)
            return popup
        time.sleep(0.1)
    return None


# =========================================================
# Locator helpers
# =========================================================

def visible_clickables(page: Page, limit: int = 250):
    loc = page.locator("a, button, [role='button']")
    count = min(loc.count(), limit)
    items = []
    for i in range(count):
        try:
            el = loc.nth(i)
            if not el.is_visible():
                continue
            box = el.bounding_box()
            if not box:
                continue
            txt = clean_text(el.inner_text())
            aria = clean_text(el.get_attribute("aria-label"))
            title = clean_text(el.get_attribute("title"))
            href = clean_text(el.get_attribute("href"))
            items.append(
                {
                    "index": i,
                    "locator": el,
                    "text": txt,
                    "aria": aria,
                    "title": title,
                    "href": href,
                    "box": box,
                }
            )
        except Exception:
            continue
    return items


def find_clickable_by_keywords(page: Page, keywords: List[str]):
    kws = [k.lower() for k in keywords]
    for item in visible_clickables(page):
        combined = " ".join(
            [
                item["text"],
                item["aria"],
                item["title"],
                item["href"],
            ]
        ).lower()
        if any(k in combined for k in kws):
            return item["locator"]
    return None


def find_heading(page: Page, name: str):
    target = name.lower()
    loc = page.locator("h1, h2, h3, h4, [role='heading']")
    count = min(loc.count(), 120)
    for i in range(count):
        try:
            el = loc.nth(i)
            txt = clean_text(el.inner_text())
            if target in txt.lower():
                return el
        except Exception:
            continue
    return None


def go_to_section(page: Page, section_name: str) -> bool:
    heading = find_heading(page, section_name)
    if heading:
        try:
            heading.scroll_into_view_if_needed(timeout=3000)
            safe_wait(page, 1000)
            log(f"Moved to section: {section_name}")
            return True
        except Exception:
            pass

    # fallback to nav/button click
    btn = find_clickable_by_keywords(page, [section_name])
    if btn:
        try:
            btn.scroll_into_view_if_needed(timeout=3000)
            safe_wait(page, 500)
            btn.click(timeout=4000)
            safe_wait(page, 1500)
            heading = find_heading(page, section_name)
            if heading:
                heading.scroll_into_view_if_needed(timeout=3000)
            log(f"Clicked into section: {section_name}")
            return True
        except Exception:
            pass

    warn(f"Could not find section: {section_name}")
    return False


# =========================================================
# Notes / extraction helpers
# =========================================================

def capture_page_snapshot(page: Page, label: str) -> Dict[str, Any]:
    return {
        "label": label,
        "title": page_title(page),
        "url": current_url(page),
        "bodyPreview": body_preview(page, 1800),
    }


def collect_headings(page: Page, limit: int = 12) -> List[str]:
    out: List[str] = []
    loc = page.locator("h1, h2, h3")
    count = min(loc.count(), limit)
    for i in range(count):
        try:
            txt = clean_text(loc.nth(i).inner_text())
            if txt:
                out.append(txt)
        except Exception:
            continue
    return out


def collect_links(page: Page, limit: int = 20) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    loc = page.locator("a")
    count = min(loc.count(), limit)
    for i in range(count):
        try:
            el = loc.nth(i)
            txt = clean_text(el.inner_text())
            href = clean_text(el.get_attribute("href"))
            if txt or href:
                out.append({"text": txt, "href": href})
        except Exception:
            continue
    return out


# =========================================================
# Recruiter-flow logic
# =========================================================

def recruiter_step_note(notes: List[str], text: str) -> None:
    notes.append(text)
    log(text)


def inspect_landing(page: Page, notes: List[str]) -> Dict[str, Any]:
    recruiter_step_note(notes, "Step 1: Opened candidate portfolio landing page.")
    safe_wait(page, 1500)

    summary = capture_page_snapshot(page, "landing")
    summary["headings"] = collect_headings(page, 10)
    summary["topLinks"] = collect_links(page, 12)

    recruiter_step_note(notes, "Step 2: Read visible top-level content and captured initial headings/links.")
    smooth_scroll_down(page, steps=2, pixels=500, pause_ms=700)
    recruiter_step_note(notes, "Step 3: Gradually scrolled to inspect the first visible content area.")
    smooth_scroll_up(page, steps=1, pixels=350, pause_ms=600)
    recruiter_step_note(notes, "Step 4: Slightly scrolled back up to re-check hero/top context.")

    return summary


def get_project_card_candidates(page: Page) -> List[Tuple[str, int]]:
    """
    Heuristic for project cards: large visible clickables in the Projects area.
    """
    cards: List[Tuple[str, int]] = []

    if not go_to_section(page, "Projects"):
        return cards

    safe_wait(page, 1200)

    seen = set()
    for item in visible_clickables(page, limit=300):
        try:
            box = item["box"]
            txt = item["text"] or item["aria"] or item["title"] or ""
            txt = short_text(txt, 90)

            if not txt:
                continue
            if box["width"] < 120 or box["height"] < 50:
                continue

            lowered = txt.lower()
            skip = ["resume", "github", "retro", "home", "contact", "about"]
            if any(s in lowered for s in skip):
                continue

            if txt in seen:
                continue
            seen.add(txt)
            cards.append((txt, item["index"]))
        except Exception:
            continue

    return cards[:12]


def open_clickable(context: BrowserContext, page: Page, locator) -> Tuple[Page, bool]:
    before = len(context.pages)
    locator.scroll_into_view_if_needed(timeout=3000)
    safe_wait(page, 500)
    locator.click(timeout=5000)
    popup = open_popup_if_any(context, before, timeout_ms=2500)
    if popup:
        return popup, True
    safe_wait(page, 1200)
    return page, False


def inspect_single_project(context: BrowserContext, page: Page, clickable_index: int, card_name: str, home_url: str) -> Optional[Dict[str, Any]]:
    try:
        clickable = page.locator("a, button, [role='button']").nth(clickable_index)
        target_page, opened_new_tab = open_clickable(context, page, clickable)

        detail = capture_page_snapshot(target_page, f"project:{card_name}")
        detail["openedInNewTab"] = opened_new_tab
        detail["headings"] = collect_headings(target_page, 12)
        detail["links"] = collect_links(target_page, 20)

        # Deep recruiter-like look
        smooth_scroll_down(target_page, steps=3, pixels=650, pause_ms=700)
        smooth_scroll_down(target_page, steps=2, pixels=900, pause_ms=800)
        smooth_scroll_up(target_page, steps=2, pixels=600, pause_ms=700)

        detail["bodyPreviewAfterScroll"] = body_preview(target_page, 2200)

        if opened_new_tab:
            target_page.close()
            safe_wait(page, 700)
        else:
            if current_url(target_page) != home_url:
                try:
                    target_page.go_back(wait_until="domcontentloaded", timeout=10000)
                    safe_wait(target_page, 1500)
                except Exception:
                    pass

        return detail
    except Exception as exc:
        warn(f"Could not inspect project '{card_name}': {exc}")
        return None


def inspect_projects_deep(context: BrowserContext, page: Page, home_url: str, notes: List[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "projectsSectionFound": False,
        "cardsDetected": [],
        "projectReviews": [],
    }

    if not go_to_section(page, "Projects"):
        recruiter_step_note(notes, "Step 5: Tried to locate Projects section but could not reliably find it.")
        return out

    out["projectsSectionFound"] = True
    recruiter_step_note(notes, "Step 5: Entered the Projects section.")
    smooth_scroll_down(page, steps=1, pixels=300, pause_ms=600)
    recruiter_step_note(notes, "Step 6: Slowly reviewed the visible project grid/cards.")

    cards = get_project_card_candidates(page)
    out["cardsDetected"] = [name for name, _ in cards]

    if not cards:
        recruiter_step_note(notes, "Step 7: No project cards were reliably detected by selector heuristics.")
        return out

    recruiter_step_note(notes, f"Step 7: Detected {len(cards)} project cards to review.")

    for idx, (card_name, clickable_index) in enumerate(cards, start=1):
        recruiter_step_note(notes, f"Step 7.{idx}: Opening project card '{card_name}'.")
        detail = inspect_single_project(context, page, clickable_index, card_name, home_url)
        if detail:
            out["projectReviews"].append(detail)

        # Re-anchor at Projects before next card
        go_to_section(page, "Projects")
        safe_wait(page, 800)

    recruiter_step_note(notes, "Step 8: Completed deep review of project cards and returned to main project grid.")
    return out


def inspect_resume_and_github(context: BrowserContext, page: Page, home_url: str, notes: List[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "resume": None,
        "github": None,
        "repositories": [],
    }

    # Resume first
    resume_el = find_clickable_by_keywords(page, ["resume", "cv"])
    if resume_el:
        recruiter_step_note(notes, "Step 9: Opening Resume link/icon.")
        try:
            resume_page, opened_new_tab = open_clickable(context, page, resume_el)
            out["resume"] = capture_page_snapshot(resume_page, "resume")
            out["resume"]["openedInNewTab"] = opened_new_tab
            out["resume"]["headings"] = collect_headings(resume_page, 12)
            out["resume"]["links"] = collect_links(resume_page, 16)

            smooth_scroll_down(resume_page, steps=3, pixels=700, pause_ms=700)
            smooth_scroll_up(resume_page, steps=1, pixels=400, pause_ms=600)
            out["resume"]["bodyPreviewAfterScroll"] = body_preview(resume_page, 2000)

            if opened_new_tab:
                resume_page.close()
            else:
                if current_url(resume_page) != home_url:
                    resume_page.go_back(wait_until="domcontentloaded", timeout=10000)
            safe_wait(page, 1000)
        except Exception as exc:
            warn(f"Resume inspection failed: {exc}")
    else:
        recruiter_step_note(notes, "Step 9: Resume link/icon was not clearly found.")

    # GitHub next
    github_el = find_clickable_by_keywords(page, ["github"])
    if github_el:
        recruiter_step_note(notes, "Step 10: Opening GitHub link/icon.")
        try:
            github_page, opened_new_tab = open_clickable(context, page, github_el)

            out["github"] = capture_page_snapshot(github_page, "github-profile")
            out["github"]["openedInNewTab"] = opened_new_tab
            out["github"]["headings"] = collect_headings(github_page, 10)
            out["github"]["links"] = collect_links(github_page, 20)

            # Open repositories tab
            repo_tab = find_clickable_by_keywords(github_page, ["repositories"])
            if repo_tab:
                recruiter_step_note(notes, "Step 11: Opening GitHub Repositories tab.")
                try:
                    repo_tab.click(timeout=5000)
                    safe_wait(github_page, 1800)
                except Exception as exc:
                    warn(f"Repositories tab click failed: {exc}")
            else:
                recruiter_step_note(notes, "Step 11: Repositories tab was not clearly detected; staying on visible GitHub profile.")

            repo_reviews = inspect_github_repos(github_page, notes)
            out["repositories"] = repo_reviews

            if opened_new_tab:
                github_page.close()
            else:
                if current_url(github_page) != home_url:
                    try:
                        github_page.go_back(wait_until="domcontentloaded", timeout=10000)
                        safe_wait(github_page, 1200)
                    except Exception:
                        pass

            safe_wait(page, 900)

        except Exception as exc:
            warn(f"GitHub inspection failed: {exc}")
    else:
        recruiter_step_note(notes, "Step 10: GitHub link/icon was not clearly found.")

    return out


def inspect_github_repos(github_page: Page, notes: List[str]) -> List[Dict[str, Any]]:
    repo_reviews: List[Dict[str, Any]] = []

    # Try common GitHub repo-name selectors
    selectors = [
        'a[itemprop="name codeRepository"]',
        'h3 a',
        'a[data-testid="repo-name"]',
    ]

    candidates: List[Tuple[str, str, str, int]] = []
    seen = set()

    for sel in selectors:
        try:
            loc = github_page.locator(sel)
            count = min(loc.count(), 8)
            for i in range(count):
                el = loc.nth(i)
                txt = clean_text(el.inner_text())
                href = clean_text(el.get_attribute("href"))
                if txt and href:
                    key = f"{txt}|{href}"
                    if key not in seen:
                        seen.add(key)
                        candidates.append((txt, href, sel, i))
        except Exception:
            continue

    recruiter_step_note(notes, f"Step 12: Detected {len(candidates)} GitHub repositories to inspect (reviewing up to 3).")

    for idx, (name, href, sel, i) in enumerate(candidates[:3], start=1):
        try:
            recruiter_step_note(notes, f"Step 12.{idx}: Opening GitHub repository '{name}'.")
            github_page.locator(sel).nth(i).click(timeout=5000)
            safe_wait(github_page, 1800)

            repo_info = capture_page_snapshot(github_page, f"github-repo:{name}")
            repo_info["headings"] = collect_headings(github_page, 12)
            repo_info["links"] = collect_links(github_page, 20)

            # recruiter-style repo read
            smooth_scroll_down(github_page, steps=2, pixels=700, pause_ms=700)
            smooth_scroll_down(github_page, steps=1, pixels=1000, pause_ms=800)
            smooth_scroll_up(github_page, steps=1, pixels=500, pause_ms=700)

            repo_info["bodyPreviewAfterScroll"] = body_preview(github_page, 2200)
            repo_reviews.append(repo_info)

            github_page.go_back(wait_until="domcontentloaded", timeout=10000)
            safe_wait(github_page, 1500)
        except Exception as exc:
            warn(f"Failed inspecting repo '{name}': {exc}")
            continue

    return repo_reviews


def inspect_retro_and_10_more_steps(context: BrowserContext, page: Page, home_url: str, notes: List[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "retroFound": False,
        "retroLanding": None,
        "postRetroSteps": [],
    }

    recruiter_step_note(notes, "Step 13: Returning to portfolio site before entering Retro.")
    try:
        page.goto(home_url, wait_until="domcontentloaded", timeout=20000)
        safe_wait(page, 1500)
    except Exception:
        pass

    if not go_to_section(page, "Retro"):
        recruiter_step_note(notes, "Step 14: Tried to open Retro but could not reliably find the Retro entry point.")
        return out

    out["retroFound"] = True
    recruiter_step_note(notes, "Step 14: Clicked/opened the Retro section.")
    safe_wait(page, 1500)

    out["retroLanding"] = capture_page_snapshot(page, "retro-landing")
    out["retroLanding"]["headings"] = collect_headings(page, 12)
    out["retroLanding"]["links"] = collect_links(page, 18)

    # 10 more recruiter-like steps after Retro
    # ---------------------------------------
    # Step A
    smooth_scroll_down(page, steps=2, pixels=500, pause_ms=700)
    out["postRetroSteps"].append({"step": 1, "action": "Gradually scrolled through the top of Retro.", "snapshot": capture_page_snapshot(page, "retro-step-1")})

    # Step B
    smooth_scroll_down(page, steps=2, pixels=800, pause_ms=700)
    out["postRetroSteps"].append({"step": 2, "action": "Reviewed additional Retro content lower on the page.", "snapshot": capture_page_snapshot(page, "retro-step-2")})

    # Step C
    links_now = collect_links(page, 20)
    out["postRetroSteps"].append({"step": 3, "action": "Captured visible links/buttons in the current Retro view.", "links": links_now})

    # Step D
    clickables = visible_clickables(page, limit=150)
    out["postRetroSteps"].append({"step": 4, "action": "Enumerated visible clickable elements in Retro for recruiter-relevant items.", "clickableCount": len(clickables)})

    # Step E - open first meaningful visible link
    opened_any = False
    for item in clickables:
        combined = " ".join([item["text"], item["aria"], item["title"], item["href"]]).lower()
        if any(k in combined for k in ["project", "certificate", "resume", "github", "experience", "work"]):
            try:
                before = len(context.pages)
                item["locator"].scroll_into_view_if_needed(timeout=3000)
                safe_wait(page, 400)
                item["locator"].click(timeout=5000)
                popup = open_popup_if_any(context, before, 2500)
                target = popup if popup else page
                out["postRetroSteps"].append({
                    "step": 5,
                    "action": f"Opened a recruiter-relevant Retro item: {item['text'] or item['aria'] or item['title'] or item['href']}",
                    "snapshot": capture_page_snapshot(target, "retro-step-5-opened"),
                })
                if popup:
                    popup.close()
                    safe_wait(page, 700)
                else:
                    if current_url(page) != home_url:
                        try:
                            page.go_back(wait_until="domcontentloaded", timeout=10000)
                            safe_wait(page, 1200)
                            go_to_section(page, "Retro")
                            safe_wait(page, 1000)
                        except Exception:
                            pass
                opened_any = True
                break
            except Exception:
                continue

    if not opened_any:
        out["postRetroSteps"].append({"step": 5, "action": "Did not find a clearly safe recruiter-relevant Retro link to open."})

    # Step F
    smooth_scroll_down(page, steps=2, pixels=900, pause_ms=700)
    out["postRetroSteps"].append({"step": 6, "action": "Continued scanning deeper into Retro.", "snapshot": capture_page_snapshot(page, "retro-step-6")})

    # Step G
    smooth_scroll_up(page, steps=1, pixels=500, pause_ms=700)
    out["postRetroSteps"].append({"step": 7, "action": "Slightly scrolled upward to re-check recent content for context.", "snapshot": capture_page_snapshot(page, "retro-step-7")})

    # Step H
    headings = collect_headings(page, 12)
    out["postRetroSteps"].append({"step": 8, "action": "Collected visible headings after deeper Retro inspection.", "headings": headings})

    # Step I
    scroll_to_bottom(page)
    out["postRetroSteps"].append({"step": 9, "action": "Scrolled near the bottom to inspect later-page content.", "snapshot": capture_page_snapshot(page, "retro-step-9")})

    # Step J
    smooth_scroll_up(page, steps=2, pixels=700, pause_ms=700)
    out["postRetroSteps"].append({"step": 10, "action": "Final recruiter pass: slightly moved upward and captured concluding context before stopping.", "snapshot": capture_page_snapshot(page, "retro-step-10")})

    recruiter_step_note(notes, "Step 15: Completed 10 additional recruiter-style steps inside/after Retro, then stopped.")
    return out


# =========================================================
# Main runner
# =========================================================

def run_recruiter_flow(start_url: str, headless: bool = False, slow_mo: int = 250) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "ok": True,
        "site": start_url,
        "notes": [],
        "landingReview": {},
        "projectsReview": {},
        "resumeAndGithubReview": {},
        "retroReview": {},
        "warnings": [],
    }

    with sync_playwright() as p:
        browser: Browser = p.chromium.launch(
            headless=headless,
            slow_mo=slow_mo,
        )
        context: BrowserContext = browser.new_context()
        page: Page = context.new_page()

        try:
            log(f"Opening portfolio: {start_url}")
            page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            safe_wait(page, 2000)

            result["landingReview"] = inspect_landing(page, result["notes"])

            result["projectsReview"] = inspect_projects_deep(
                context=context,
                page=page,
                home_url=start_url,
                notes=result["notes"],
            )

            # Re-open home before resume/github
            page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            safe_wait(page, 1500)

            result["resumeAndGithubReview"] = inspect_resume_and_github(
                context=context,
                page=page,
                home_url=start_url,
                notes=result["notes"],
            )

            result["retroReview"] = inspect_retro_and_10_more_steps(
                context=context,
                page=page,
                home_url=start_url,
                notes=result["notes"],
            )

        except Exception as exc:
            result["ok"] = False
            result["warnings"].append(str(exc))
        finally:
            safe_wait(page, 1000)
            browser.close()

    return result


# =========================================================
# CLI
# =========================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a recruiter-style public portfolio review.")
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"Public portfolio URL (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run headless. Default is visible browser.",
    )
    parser.add_argument(
        "--slow-mo",
        type=int,
        default=250,
        help="Playwright slow motion in ms (default: 250).",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    result = run_recruiter_flow(
        start_url=args.url,
        headless=args.headless,
        slow_mo=args.slow_mo,
    )

    if args.pretty:
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps(result))

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())