import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO


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
