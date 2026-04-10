#!/usr/bin/env python3
from common import apply_common_options, emit, fail, import_nextdraw, read_payload, run_quiet


UTILITY_MAP = {
  "toggle": "toggle",
  "align": "disable_xy",
  "walk_home": "walk_home",
  "lower_pen": "lower_pen",
  "raise_pen": "raise_pen",
  "disable_xy": "disable_xy",
  "enable_xy": "enable_xy",
  "read_name": "read_name",
  "list_names": "list_names"
}

MODE_MAP = {
  "sysinfo": "sysinfo",
  "version": "version"
}


def run_command(payload):
  command = str(payload.get("command", "")).strip()
  if not command:
    raise ValueError("Missing command")

  NextDraw = import_nextdraw()
  nd = NextDraw()
  nd.plot_setup()
  apply_common_options(nd, payload)

  if command in MODE_MAP:
    nd.options.mode = MODE_MAP[command]
  elif command in UTILITY_MAP:
    nd.options.mode = "utility"
    nd.options.utility_cmd = UTILITY_MAP[command]
  else:
    raise ValueError(f"Unknown command: {command}")

  run_quiet(lambda: nd.plot_run())
  return {"ok": True, "result": f"Ran {command}"}


def rename_machine(payload):
  write_name_val = str(payload.get("writeName", payload.get("name", ""))).strip()
  if not write_name_val:
    raise ValueError("Missing device nickname for write_name")
  display_name = str(payload.get("displayName", write_name_val)).strip()

  NextDraw = import_nextdraw()
  nd = NextDraw()
  nd.plot_setup()
  apply_common_options(nd, payload)
  nd.options.mode = "utility"
  nd.options.utility_cmd = f"write_name{write_name_val}"
  run_quiet(lambda: nd.plot_run())
  return {"ok": True, "result": f"Renamed to {display_name}"}


def main():
  payload = read_payload()
  action = str(payload.get("action", "command")).strip()
  try:
    if action == "rename":
      emit(rename_machine(payload))
    else:
      emit(run_command(payload))
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
