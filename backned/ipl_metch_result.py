import argparse
import json
import os
import re
import time
from datetime import date, datetime, timedelta

import requests

URL = "https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/284-matchschedule.js?MatchSchedule=_jqjsp"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALL_MATCHES_FILE = os.path.join(BASE_DIR, "matchschedule.json")
UPCOMING_MATCHES_FILE = os.path.join(BASE_DIR, "upcoming_matches.json")
COMPLETED_MATCHES_FILE = os.path.join(BASE_DIR, "completed_matches.json")


def extract_json_from_jsonp(payload):
    # JSONP wrapper looks like: callback({...})
    match = re.search(r"^[^(]*\((.*)\)\s*;?\s*$", payload, re.DOTALL)
    if not match:
        raise ValueError("No JSON found in response")
    return match.group(1)


def is_completed_match(match_item):
    status = str(match_item.get("MatchStatus", "")).strip().lower()
    if status == "post":
        return True

    match_date = str(match_item.get("MatchDate", "")).strip()
    if match_date:
        try:
            parsed_date = datetime.strptime(match_date, "%Y-%m-%d").date()
            return parsed_date < date.today()
        except ValueError:
            pass

    return False


def split_matches_by_status(schedule):
    matches = schedule.get("Matchsummary", [])
    completed = []
    upcoming = []

    for match_item in matches:
        if is_completed_match(match_item):
            completed.append(match_item)
        else:
            upcoming.append(match_item)

    return completed, upcoming


def get_match_datetime(match_item):
    match_date = str(match_item.get("MatchDate", "")).strip()
    match_time = str(match_item.get("MatchTime", "")).strip()

    if not match_date:
        return datetime.min

    if not match_time:
        match_time = "00:00"

    try:
        return datetime.strptime(f"{match_date} {match_time}", "%Y-%m-%d %H:%M")
    except ValueError:
        return datetime.min


def sort_matches_latest_first(matches):
    return sorted(matches, key=get_match_datetime, reverse=True)


def save_json(path, payload):
    with open(path, "w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2)


def fetch_and_save():
    response = requests.get(URL, timeout=30)
    response.raise_for_status()

    print("Status:", response.status_code)

    data = response.text.strip()
    print("Raw preview:", data[:200])

    json_str = extract_json_from_jsonp(data)
    parsed = json.loads(json_str)

    all_matches = parsed.get("Matchsummary", [])
    all_matches = sort_matches_latest_first(all_matches)
    completed_matches, upcoming_matches = split_matches_by_status(parsed)
    completed_matches = sort_matches_latest_first(completed_matches)
    upcoming_matches = sort_matches_latest_first(upcoming_matches)

    parsed["Matchsummary"] = all_matches

    save_json(ALL_MATCHES_FILE, parsed)
    save_json(COMPLETED_MATCHES_FILE, {"Matchsummary": completed_matches})
    save_json(UPCOMING_MATCHES_FILE, {"Matchsummary": upcoming_matches})

    print(f"Saved {len(all_matches)} total matches to {os.path.basename(ALL_MATCHES_FILE)}")
    print(f"Saved {len(completed_matches)} completed matches to {os.path.basename(COMPLETED_MATCHES_FILE)}")
    print(f"Saved {len(upcoming_matches)} upcoming matches to {os.path.basename(UPCOMING_MATCHES_FILE)}")


def parse_time_24h(time_value):
    try:
        datetime.strptime(time_value, "%H:%M")
    except ValueError as error:
        raise ValueError("Invalid time format. Use HH:MM in 24-hour format, for example 06:00") from error


def get_next_run_datetime(time_value):
    hour, minute = map(int, time_value.split(":"))
    now = datetime.now()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    if target <= now:
        target = target + timedelta(days=1)

    return target


def run_cron_mode(time_value, run_immediately=False, max_runs=None):
    runs = 0

    if run_immediately:
        print("Running immediate fetch before scheduler starts...")
        fetch_and_save()
        runs += 1
        if max_runs is not None and runs >= max_runs:
            print("Reached max runs. Exiting scheduler.")
            return

    while True:
        next_run = get_next_run_datetime(time_value)
        wait_seconds = (next_run - datetime.now()).total_seconds()
        print(f"Next run at {next_run.strftime('%Y-%m-%d %H:%M:%S')}")

        # Sleep in chunks so Ctrl+C remains responsive.
        while wait_seconds > 0:
            chunk = min(wait_seconds, 30)
            time.sleep(chunk)
            wait_seconds -= chunk

        print(f"Starting scheduled fetch at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        fetch_and_save()
        runs += 1

        if max_runs is not None and runs >= max_runs:
            print("Reached max runs. Exiting scheduler.")
            return


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fetch IPL schedule and split it into all, upcoming, and completed match files."
    )
    parser.add_argument(
        "--mode",
        choices=["once", "cron"],
        default="once",
        help="Run mode: once (default) or cron (daily at set time).",
    )
    parser.add_argument(
        "--time",
        default="06:00",
        help="Daily scheduled time in HH:MM 24-hour format. Used in cron mode. Default is 06:00.",
    )
    parser.add_argument(
        "--run-immediately",
        action="store_true",
        help="In cron mode, run one fetch immediately before waiting for the next scheduled time.",
    )
    parser.add_argument(
        "--max-runs",
        type=int,
        default=None,
        help="Optional number of runs in cron mode, useful for testing.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.mode == "once":
        fetch_and_save()
        return

    parse_time_24h(args.time)
    run_cron_mode(
        time_value=args.time,
        run_immediately=args.run_immediately,
        max_runs=args.max_runs,
    )


if __name__ == "__main__":
    main()