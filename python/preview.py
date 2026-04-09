#!/usr/bin/env python3
import os
from pathlib import Path

from common import apply_common_options, emit, fail, import_nextdraw, read_payload, run_quiet, safe_float


def resolve_file_path(relative_path):
  svg_dir = os.getenv("SVGDIR", "")
  base = Path(svg_dir).expanduser().resolve()
  candidate = (base / str(relative_path)).resolve()
  if not str(candidate).startswith(str(base)):
    raise ValueError("Invalid file path")
  if not candidate.exists():
    raise FileNotFoundError(f"SVG file not found: {relative_path}")
  return str(candidate)


def main():
  payload = read_payload()
  try:
    file_path = resolve_file_path(payload.get("filePath", ""))
    NextDraw = import_nextdraw()

    nd = NextDraw()
    nd.plot_setup(file_path)
    apply_common_options(nd, payload)
    nd.options.preview = True
    nd.options.report_time = True
    run_quiet(lambda: nd.plot_run())

    emit({
      "status": "ok",
      "timeEstimate": safe_float(getattr(nd, "time_estimate", 0)),
      "distancePenDown": safe_float(getattr(nd, "distance_pendown", 0)),
      "distanceTotal": safe_float(getattr(nd, "distance_total", 0)),
      "penLifts": int(getattr(nd, "pen_lifts", 0))
    })
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
