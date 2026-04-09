#!/usr/bin/env python3
import os
import time
from pathlib import Path

from common import apply_common_options, emit, fail, import_nextdraw, read_payload, run_quiet, safe_float


def resolve_file_path(relative_path):
  svg_dir = os.getenv("SVGDIR", "")
  base = Path(svg_dir).expanduser().resolve()
  candidate = (base / str(relative_path)).resolve()
  if not str(candidate).startswith(str(base)):
    raise ValueError("Invalid file path")
  return str(candidate)


def fallback_estimate_seconds(file_path):
  try:
    file_size = Path(file_path).stat().st_size
  except Exception:
    file_size = 10000
  return max(15.0, min((file_size / 6000.0), 240.0))


def run_preview(payload):
  file_path = resolve_file_path(payload.get("filePath", ""))
  if not Path(file_path).exists():
    estimate = fallback_estimate_seconds(file_path)
    return {
      "status": "ok",
      "timeEstimate": estimate,
      "distancePenDown": round(estimate / 30.0, 2),
      "distanceTotal": round(estimate / 20.0, 2),
      "penLifts": int(estimate / 2)
    }
  try:
    NextDraw = import_nextdraw()
    nd = NextDraw()
    nd.plot_setup(file_path)
    apply_common_options(nd, payload)
    nd.options.preview = True
    nd.options.report_time = True
    run_quiet(lambda: nd.plot_run())
    return {
      "status": "ok",
      "timeEstimate": safe_float(getattr(nd, "time_estimate", 0)),
      "distancePenDown": safe_float(getattr(nd, "distance_pendown", 0)),
      "distanceTotal": safe_float(getattr(nd, "distance_total", 0)),
      "penLifts": int(getattr(nd, "pen_lifts", 0))
    }
  except Exception:
    estimate = fallback_estimate_seconds(file_path)
    return {
      "status": "ok",
      "timeEstimate": estimate,
      "distancePenDown": round(estimate / 30.0, 2),
      "distanceTotal": round(estimate / 20.0, 2),
      "penLifts": int(estimate / 2)
    }


def run_plot(payload):
  preview = run_preview(payload)
  estimate = safe_float(preview.get("timeEstimate", 20.0), 20.0)
  emit({
    "status": "started",
    "timeEstimate": estimate
  })

  # Simulate quickly in development: 10% of estimate, clamped.
  simulated = max(3.0, min(estimate * 0.1, 45.0))
  time.sleep(simulated)
  emit({
    "status": "complete",
    "timeElapsed": simulated
  })


def run_command(payload):
  command = str(payload.get("command", "command")).strip() or "command"
  emit({
    "ok": True,
    "result": f"Virtual machine executed: {command}"
  })


def main():
  payload = read_payload()
  action = str(payload.get("action", "preview")).strip()

  try:
    if action == "preview":
      emit(run_preview(payload))
      return
    if action == "plot":
      run_plot(payload)
      return
    if action == "command":
      run_command(payload)
      return
    fail(f"Unknown virtual action: {action}")
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
