#!/usr/bin/env python3
"""
RAVEN CLI — Continuous Reliability & Regression Testing for AI Agents

Usage:
  raven test --agent <ID> [--suite <ID>] [--fail-under <SCORE>] [--output <FILE>] [--url <API_URL>]

Examples:
  raven test --agent 3 --fail-under 80 --output pr-report.md
  python apps/cli/raven_cli.py test --agent 3 --fail-under 85
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

DEFAULT_API_URL = os.getenv("RAVEN_API_URL", "http://127.0.0.1:8000")


def run_test(args):
    """Executes the test suite and checks the CI gate status."""
    api_url = args.url.rstrip("/")
    agent_id = args.agent
    fail_under = args.fail_under
    suite_id = args.suite
    output_file = args.output

    print(f"\n🦅 RAVEN Agent CI/CD Runner")
    print(f"Target Agent: #{agent_id}")
    print(f"Gate Threshold: {fail_under}%")
    print(f"API Endpoint: {api_url}\n")
    print("⏳ Executing test suite and analyzing reliability...")

    payload = {
        "agent_id": agent_id,
        "fail_under": fail_under,
    }
    if suite_id is not None:
        payload["suite_id"] = suite_id

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url}/ci/run",
        data=req_data,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"❌ API Error ({e.code}): {err_body}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"❌ Connection error: Could not reach RAVEN API at {api_url}: {e}", file=sys.stderr)
        sys.exit(2)
    gate_passed = data.get("gate_passed", False)
    gate_status = data.get("gate_status", "FAIL")
    score = data.get("reliability_score", 0.0)
    score_change_str = data.get("score_change_str", "")
    new_failures = data.get("new_failures", 0)
    fixed_failures = data.get("fixed_failures", 0)
    markdown = data.get("markdown_summary", "")

    # Output CLI summary table
    print("\n" + "=" * 55)
    print(f"  RAVEN BENCHMARK RESULTS — {data.get('agent_name', f'Agent #{agent_id}')}")
    print("=" * 55)
    print(f"  Reliability Score : {score}% ({score_change_str})")
    print(f"  Pass Rate         : {data.get('pass_rate', 0)}%")
    print(f"  Scenarios         : {data.get('passed', 0)} passed / {data.get('total', 0)} total")
    print(f"  New Failures      : {new_failures}")
    print(f"  Fixed Failures    : {fixed_failures}")
    print(f"  Regression Alert  : {'⚠️ YES' if data.get('regression_detected') else '✅ NONE'}")
    print("-" * 55)
    if gate_passed:
        print(f"  CI GATE STATUS    : ✅ PASSED (score >= {fail_under}%)")
    else:
        print(f"  CI GATE STATUS    : ❌ FAILED (score < {fail_under}%)")
    print("=" * 55 + "\n")

    # Write markdown report if requested
    if output_file:
        try:
            with open(output_file, "w") as f:
                f.write(markdown)
            print(f"📝 PR Markdown report written to: {output_file}\n")
        except IOError as e:
            print(f"⚠️ Warning: Could not write output report to {output_file}: {e}", file=sys.stderr)

    if not gate_passed:
        print(f"❌ CI Gate rejected: Agent reliability score ({score}%) is below the {fail_under}% threshold.\n")
        sys.exit(1)
    else:
        print(f"✅ CI Gate approved: Agent meets quality requirements.\n")
        sys.exit(0)


def run_agents(args):
    """Lists all registered agents."""
    api_url = args.url.rstrip("/")
    try:
        req = urllib.request.Request(f"{api_url}/agents/")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"❌ Connection error: Could not reach RAVEN API at {api_url}: {e}", file=sys.stderr)
        sys.exit(2)

    agents = data.get("agents", [])
    print("\n" + "=" * 65)
    print("  RAVEN REGISTERED AGENTS")
    print("=" * 65)
    print(f"  {'ID':<5} | {'Agent Name':<25} | {'Model':<15} | {'Tools'}")
    print("-" * 65)
    for a in agents:
        tools_str = ", ".join(t.get("name", "") for t in a.get("tools", []))
        print(f"  #{a.get('id'):<4} | {a.get('name', '')[:25]:<25} | {a.get('model', '')[:15]:<15} | {tools_str}")
    print("=" * 65 + "\n")


def run_trace(args):
    """Displays a visual execution trace tree in terminal."""
    api_url = args.url.rstrip("/")
    execution_id = args.id
    try:
        req = urllib.request.Request(f"{api_url}/trace/{execution_id}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"❌ Could not retrieve trace #{execution_id} from {api_url}: {e}", file=sys.stderr)
        sys.exit(2)

    print("\n" + "=" * 65)
    print(f"  EXECUTION TRACE #{data.get('execution_id')} — {data.get('agent_name')} (v{data.get('version')})")
    print("=" * 65)
    steps = data.get("steps", [])
    for step in steps:
        idx = step.get("index")
        label = step.get("label")
        content = step.get("data")
        print(f"\n[Step {idx}: {label}]")
        if isinstance(content, dict):
            print(json.dumps(content, indent=2))
        else:
            print(f"  {content}")
    print("\n" + "=" * 65 + "\n")


def run_benchmark(args):
    """Runs a multi-model benchmark from terminal."""
    api_url = args.url.rstrip("/")
    agent_id = args.agent
    models = args.models or [
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-2.0-flash-exp:free"
    ]
    print(f"\n⏳ Benchmarking Agent #{agent_id} across {len(models)} models...")
    payload = json.dumps({"agent_id": agent_id, "model_ids": models}).encode("utf-8")
    req = urllib.request.Request(
        f"{api_url}/benchmark/run",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"❌ Benchmark failed: {e}", file=sys.stderr)
        sys.exit(2)

    leaderboard = data.get("leaderboard", [])
    print("\n" + "=" * 75)
    print(f"  MULTI-MODEL BENCHMARK LEADERBOARD — {data.get('agent_name')}")
    print("=" * 75)
    print(f"  {'Rank':<5} | {'Model Name':<28} | {'Reliability':<12} | {'Latency':<9} | {'Status'}")
    print("-" * 75)
    for m in leaderboard:
        print(f"  #{m.get('rank', '-'):<4} | {m.get('model_name')[:28]:<28} | {m.get('reliability_score'):>5.1f}%      | {m.get('avg_latency_ms'):>4} ms  | {m.get('status')}")
    print("=" * 75 + "\n")


def main():
    parser = argparse.ArgumentParser(
        prog="raven",
        description="RAVEN Autonomous Agent Reliability & CI/CD CLI"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # 1. raven test
    test_parser = subparsers.add_parser("test", help="Run benchmark suite and enforce CI quality gate")
    test_parser.add_argument("--agent", type=int, required=True, help="Agent ID to benchmark")
    test_parser.add_argument("--suite", type=int, default=None, help="Specific test suite ID (optional)")
    test_parser.add_argument("--fail-under", type=float, default=80.0, help="Minimum reliability score threshold percent (default: 80.0)")
    test_parser.add_argument("--output", "-o", type=str, default=None, help="Path to write PR markdown comment report file")
    test_parser.add_argument("--url", type=str, default=DEFAULT_API_URL, help=f"RAVEN API base URL (default: {DEFAULT_API_URL})")

    # 2. raven agents
    agents_parser = subparsers.add_parser("agents", help="List all registered agents and their IDs")
    agents_parser.add_argument("--url", type=str, default=DEFAULT_API_URL, help=f"RAVEN API base URL")

    # 3. raven trace
    trace_parser = subparsers.add_parser("trace", help="Inspect visual execution trace tree by ID")
    trace_parser.add_argument("--id", type=int, required=True, help="Execution ID to inspect")
    trace_parser.add_argument("--url", type=str, default=DEFAULT_API_URL, help=f"RAVEN API base URL")

    # 4. raven benchmark
    bench_parser = subparsers.add_parser("benchmark", help="Run multi-model comparison benchmark")
    bench_parser.add_argument("--agent", type=int, required=True, help="Agent ID to benchmark")
    bench_parser.add_argument("--models", nargs="+", default=None, help="Model IDs to test")
    bench_parser.add_argument("--url", type=str, default=DEFAULT_API_URL, help=f"RAVEN API base URL")

    args = parser.parse_args()

    if args.command == "test":
        run_test(args)
    elif args.command == "agents":
        run_agents(args)
    elif args.command == "trace":
        run_trace(args)
    elif args.command == "benchmark":
        run_benchmark(args)


if __name__ == "__main__":
    main()

