#!/usr/bin/env python3
import os
from pathlib import Path

from common import (
  apply_common_options,
  debug_log,
  emit,
  fail,
  import_nextdraw,
  read_payload,
  resolve_cached_source,
  run_quiet,
  safe_float,
)


def resolve_file_path(relative_path):
  svg_dir = os.getenv("SVGDIR", "")
  base = Path(svg_dir).expanduser().resolve()
  candidate = (base / str(relative_path)).resolve()
  if not str(candidate).startswith(str(base)):
    raise ValueError("Invalid file path")
  if not candidate.exists():
    raise FileNotFoundError(f"SVG file not found: {relative_path}")
  return str(candidate)


def estimate_plot_time(NextDraw, file_path, payload):
  nd = NextDraw()
  nd.plot_setup(file_path)
  apply_common_options(nd, payload)
  nd.options.preview = True
  nd.options.report_time = True
  run_quiet(lambda: nd.plot_run())
  return safe_float(getattr(nd, "time_estimate", 0))


def collect_plot_errors(nd, quiet):
  """
  NextDraw swallows certain failures (serial connect, machine.err, logged
  ERROR messages) and `plot_run()` simply returns. Without this inspection
  plot.py would happily emit `status: complete` for a plot that never ran.
  """
  errors = []
  machine = getattr(nd, "machine", None)
  machine_err = getattr(machine, "err", None) if machine is not None else None
  if machine_err:
    errors.append(str(machine_err).strip())

  error_out = str(getattr(nd, "error_out", "") or "").strip()
  if error_out:
    errors.append(error_out)

  plot_status = getattr(nd, "plot_status", None)
  stopped = 0
  try:
    stopped = int(getattr(plot_status, "stopped", 0) or 0)
  except (TypeError, ValueError):
    stopped = 0
  if stopped:
    errors.append(f"NextDraw stopped before finishing (code {stopped})")

  # A real plot emits at least some motor traffic to the user log; if stderr
  # looks like a traceback or "Error:" line, surface it rather than treating
  # the run as successful.
  captured_stdout = (quiet.get("stdout") or "").strip()
  captured_stderr = (quiet.get("stderr") or "").strip()
  stderr_error_lines = [
    line for line in captured_stderr.splitlines()
    if line.strip().lower().startswith(("error", "traceback", "exception"))
  ]
  if stderr_error_lines:
    errors.append("\n".join(stderr_error_lines))

  return errors, captured_stdout, captured_stderr


def main():
  payload = read_payload()
  try:
    svg_path = resolve_file_path(payload.get("filePath", ""))
    NextDraw = import_nextdraw()

    source_path, used_plob = resolve_cached_source(NextDraw, svg_path, payload)
    debug_log("plot", f"source={source_path} used_plob={used_plob}")

    estimate = estimate_plot_time(NextDraw, source_path, payload)
    emit({
      "status": "started",
      "timeEstimate": estimate,
      "usedPlob": bool(used_plob),
    })

    nd = NextDraw()
    nd.plot_setup(source_path)
    apply_common_options(nd, payload)
    nd.options.preview = False
    nd.options.report_time = True
    quiet = run_quiet(lambda: nd.plot_run())

    errors, captured_stdout, captured_stderr = collect_plot_errors(nd, quiet)
    time_elapsed = safe_float(getattr(nd, "time_elapsed", 0))

    debug_log(
      "plot",
      f"plot_run finished: time_elapsed={time_elapsed:.3f}s errors={len(errors)}",
    )
    if captured_stdout:
      debug_log("plot", f"plot_run stdout ({len(captured_stdout)} chars): {captured_stdout[:1500]}")
    if captured_stderr:
      debug_log("plot", f"plot_run stderr ({len(captured_stderr)} chars): {captured_stderr[:1500]}")

    if errors:
      fail("Plot did not complete: " + " | ".join(errors))
      return

    emit({
      "status": "complete",
      "timeElapsed": time_elapsed,
      "distancePenDown": safe_float(getattr(nd, "distance_pendown", 0)),
      "distanceTotal": safe_float(getattr(nd, "distance_total", 0)),
      "usedPlob": bool(used_plob),
    })
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
