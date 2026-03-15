#!/usr/bin/env python3
"""
run-social-capture-batch.py

Batch runner for 10+ candidates.

Usage:
python apps/llm/agents/scripts/run-social-capture-batch.py \
  --input apps/llm/agents/scripts/candidates.json \
  --output apps/llm/agents/scripts/output/social-capture-batch.json \
  --timeout-seconds 180 \
  --poll-interval-seconds 3 \
  --pretty

Input JSON example:
[
  {
    "candidateId": "cand_001",
    "name": "Nguyen Phan Nguyen",
    "linkedin": "https://www.linkedin.com/in/nguyenpn1/",
    "github": "https://github.com/ngstephen1",
    "webQueries": [
      "Nguyen Phan Nguyen Virginia Tech",
      "Nguyen Phan Nguyen Software Engineer"
    ]
  }
]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from typing import Any, Dict, List

from social_capture_batch_helper import (
    build_batch_summary,
    load_candidates_from_json,
    run_single_capture,
    write_json,
)


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run social capture for many candidates.")
    parser.add_argument("--input", required=True, help="Path to input JSON list of candidates")
    parser.add_argument("--output", help="Optional output JSON file path")
    parser.add_argument("--timeout-seconds", type=int, default=180)
    parser.add_argument("--poll-interval-seconds", type=float, default=3.0)
    parser.add_argument("--local-browser", action="store_true")
    parser.add_argument("--manual-linkedin-login", action="store_true")
    parser.add_argument("--debug-logs", action="store_true")
    parser.add_argument("--prefer-chrome", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        candidates = load_candidates_from_json(args.input)
    except Exception as exc:
        eprint(f"[ERROR] Failed to load input: {exc}")
        return 2

    results: List[Dict[str, Any]] = []

    for idx, candidate in enumerate(candidates, start=1):
        eprint(f"[INFO] ({idx}/{len(candidates)}) Running social capture for: {candidate.name}")

        result = run_single_capture(
            candidate=candidate,
            timeout_seconds=args.timeout_seconds,
            poll_interval_seconds=args.poll_interval_seconds,
            use_local_browser=args.local_browser,
            manual_linkedin_login=args.manual_linkedin_login,
            debug_logs=args.debug_logs,
            prefer_chrome=args.prefer_chrome,
        )
        results.append(asdict(result))

        status_text = "OK" if result.ok else "FAILED"
        eprint(
            f"[INFO] Completed: {candidate.name} | status={status_text} "
            f"| mode={result.mode} | timedOut={result.timedOut}"
        )

    payload = {
        "ok": True,
        "summary": build_batch_summary(
            [
                type("Obj", (), r)()  # lightweight object-like wrapper not needed for serialization
                for r in []
            ]
        ),
        "results": results,
    }

    # Build summary directly from result dicts
    total = len(results)
    ok_count = sum(1 for r in results if r.get("ok"))
    failed_count = total - ok_count
    timed_out_count = sum(1 for r in results if r.get("timedOut") is True)
    by_mode: Dict[str, int] = {}
    for r in results:
        mode = r.get("mode") or "unknown"
        by_mode[mode] = by_mode.get(mode, 0) + 1

    payload["summary"] = {
        "total": total,
        "ok": ok_count,
        "failed": failed_count,
        "timedOut": timed_out_count,
        "byMode": by_mode,
    }

    if args.output:
        try:
            write_json(args.output, payload)
            eprint(f"[INFO] Wrote batch output to: {args.output}")
        except Exception as exc:
            eprint(f"[ERROR] Failed to write output: {exc}")
            return 1

    if args.pretty:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(payload, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())