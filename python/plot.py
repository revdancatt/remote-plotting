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


def enable_strict_errors(nd):
  """
  By default NextDraw's Python API swallows connect/button/disconnect/power/
  homing failures: `plot_run()` returns quietly and leaves the caller to
  infer that nothing happened. Flipping these flags makes `handle_errors()`
  raise a `RuntimeError` that we can surface as a proper `status: error`.
  """
  errors_cfg = getattr(nd, "errors", None)
  if errors_cfg is None:
    return
  for flag in ("connect", "button", "keyboard", "disconnect", "power", "homing"):
    try:
      setattr(errors_cfg, flag, True)
    except AttributeError:
      pass


def estimate_plot_time(NextDraw, file_path, payload):
  nd = NextDraw()
  nd.plot_setup(file_path)
  apply_common_options(nd, payload)
  nd.options.preview = True
  nd.options.report_time = True
  # Preview doesn't touch serial, but enable strict mode anyway for symmetry.
  enable_strict_errors(nd)
  run_quiet(lambda: nd.plot_run())
  return safe_float(getattr(nd, "time_estimate", 0))


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
    enable_strict_errors(nd)
    quiet = run_quiet(lambda: nd.plot_run())

    time_elapsed = safe_float(getattr(nd, "time_elapsed", 0))
    distance_pendown = safe_float(getattr(nd, "distance_pendown", 0))
    distance_total = safe_float(getattr(nd, "distance_total", 0))
    stopped = int(getattr(getattr(nd, "plot_status", None), "stopped", 0) or 0)
    captured_stdout = (quiet.get("stdout") or "").strip()
    captured_stderr = (quiet.get("stderr") or "").strip()

    debug_log(
      "plot",
      f"plot_run finished: elapsed={time_elapsed:.3f}s distance_total={distance_total:.3f}m "
      f"pen_lifts={int(getattr(nd, 'pen_lifts', 0) or 0)} stopped={stopped}",
    )
    if captured_stdout:
      debug_log("plot", f"plot_run stdout ({len(captured_stdout)} chars): {captured_stdout[:1500]}")
    if captured_stderr:
      debug_log("plot", f"plot_run stderr ({len(captured_stderr)} chars): {captured_stderr[:1500]}")

    # Strict errors should have raised already, but as a belt-and-braces
    # guard: a non-preview plot with estimate > 0 that reports zero travel
    # almost certainly means the run never reached the motors.
    if distance_total <= 0 and estimate > 1:
      details = []
      if captured_stderr:
        details.append(captured_stderr[:500])
      if captured_stdout:
        details.append(captured_stdout[:500])
      extra = ("\n\nNextDraw output:\n" + "\n---\n".join(details)) if details else ""
      fail(
        "Plot reported no travel but the estimate was "
        f"{estimate:.1f}s — the plotter likely failed to connect or start."
        + extra
      )
      return

    emit({
      "status": "complete",
      "timeElapsed": time_elapsed,
      "distancePenDown": distance_pendown,
      "distanceTotal": distance_total,
      "usedPlob": bool(used_plob),
    })
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
