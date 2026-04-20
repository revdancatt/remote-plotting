import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path


PLOB_SUFFIX = ".plob"


def debug_enabled():
  return os.environ.get("REMOTE_PLOTTING_DEBUG", "").lower() in ("1", "true", "yes")


def debug_log(tag, msg):
  if debug_enabled():
    print(f"[remote-plotting:{tag}] {msg}", file=sys.stderr, flush=True)


def read_payload():
  raw = sys.stdin.read().strip()
  if not raw:
    return {}
  try:
    return json.loads(raw)
  except Exception:
    return {}


def emit(payload):
  sys.stdout.write(json.dumps(payload) + "\n")
  sys.stdout.flush()


def emit_error(message):
  emit({"status": "error", "error": str(message)})


def fail(message, code=1):
  emit_error(message)
  sys.exit(code)


def coerce_bool(value):
  if isinstance(value, bool):
    return value
  if isinstance(value, str):
    return value.lower() == "true"
  return bool(value)


def safe_float(value, fallback=0.0):
  try:
    return float(value)
  except Exception:
    return fallback


def safe_int(value, fallback=0):
  try:
    return int(value)
  except Exception:
    return fallback


def import_nextdraw():
  try:
    from nextdraw import NextDraw  # type: ignore
    return NextDraw
  except Exception as error:
    raise RuntimeError("nextdraw python package is not installed") from error


def apply_common_options(nd, payload):
  options = payload.get("options", {}) or {}
  nd.options.model = safe_int(options.get("model"), safe_int(payload.get("model"), 8))
  nd.options.handling = safe_int(options.get("handling"), 1)
  nd.options.speed_pendown = safe_int(options.get("speed"), 20)
  nd.options.penlift = safe_int(options.get("penlift"), 1)
  nd.options.reordering = safe_int(options.get("reordering"), 0)
  nd.options.random_start = coerce_bool(options.get("randomStart"))
  nd.options.hiding = coerce_bool(options.get("hiding"))

  webhook_url = str(options.get("webhook", "")).strip()
  if webhook_url:
    nd.options.webhook = True
    nd.options.webhook_url = webhook_url
  else:
    nd.options.webhook = False

  port_value = str(payload.get("port", "")).strip()
  if port_value:
    nd.options.port = port_value


def run_quiet(callback):
  stdout_capture = StringIO()
  stderr_capture = StringIO()
  with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
    result = callback()
  return {
    "result": result,
    "stdout": stdout_capture.getvalue().strip(),
    "stderr": stderr_capture.getvalue().strip()
  }


def plob_path_for(svg_path):
  """Sibling cache file: drawing.svg -> drawing.svg.plob."""
  return str(svg_path) + PLOB_SUFFIX


def plob_is_fresh(svg_path, plob_path):
  """True when an existing plob is at least as new as the source SVG."""
  try:
    svg_mtime = Path(svg_path).stat().st_mtime
    plob_mtime = Path(plob_path).stat().st_mtime
  except FileNotFoundError:
    return False
  if Path(plob_path).stat().st_size < 32:
    return False
  return plob_mtime >= svg_mtime


def generate_plob(NextDraw, svg_path, plob_path, payload):
  """Run NextDraw in digest-only preview mode and write the plob sidecar."""
  nd = NextDraw()
  nd.plot_setup(svg_path)
  apply_common_options(nd, payload)
  nd.options.preview = True
  nd.options.digest = 2
  result = run_quiet(lambda: nd.plot_run(output=True))
  output = result.get("result")
  if not output:
    raise RuntimeError("Plob generation returned empty output")
  text = output.decode("utf-8") if isinstance(output, bytes) else str(output)
  tmp_path = f"{plob_path}.tmp"
  with open(tmp_path, "w", encoding="utf-8") as handle:
    handle.write(text)
  os.replace(tmp_path, plob_path)


def resolve_cached_source(NextDraw, svg_path, payload):
  """
  Return a file path to feed into plot_setup. If a fresh plob sibling is
  present we use it (NextDraw skips hidden-line / reordering work).
  Otherwise we try to generate a plob from the SVG; failure falls back to
  the SVG itself so plotting still proceeds.
  """
  plob_path = plob_path_for(svg_path)
  if plob_is_fresh(svg_path, plob_path):
    debug_log("digest", f"reusing plob {plob_path}")
    return plob_path, True
  try:
    generate_plob(NextDraw, svg_path, plob_path, payload)
    debug_log("digest", f"wrote plob {plob_path}")
    return plob_path, True
  except Exception as error:
    debug_log("digest", f"plob generation failed ({error}); using raw svg")
    return svg_path, False
