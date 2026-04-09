#!/usr/bin/env python3
from common import emit, fail, import_nextdraw, run_quiet


def pair_names(values):
  cleaned = [str(item).strip() for item in values if str(item).strip()]
  if not cleaned:
    return []

  machines = []
  idx = 0
  while idx < len(cleaned):
    name = cleaned[idx]
    port = cleaned[idx + 1] if idx + 1 < len(cleaned) else name
    machines.append({
      "name": name,
      "port": port
    })
    idx += 2
  return machines


def main():
  try:
    NextDraw = import_nextdraw()
    nd = NextDraw()
    nd.plot_setup()
    nd.options.mode = "utility"
    nd.options.utility_cmd = "list_names"
    run_quiet(lambda: nd.plot_run())

    raw_list = getattr(nd, "name_list", [])
    if isinstance(raw_list, str):
      parsed = pair_names(raw_list.splitlines())
    elif isinstance(raw_list, list):
      parsed = pair_names(raw_list)
    else:
      parsed = []

    emit({
      "machines": parsed
    })
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
