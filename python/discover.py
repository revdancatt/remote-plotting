#!/usr/bin/env python3
from common import emit, fail, import_nextdraw, run_quiet


def machines_from_name_list(raw_entries):
  """
  NextDraw's list_names fills name_list via ebb3_serial.list_named_ebbs():
  one string per board — either a USB "friendly" nickname or the device path
  when no name is available. It is NOT alternating (name, port) pairs.
  """
  from plotink import ebb3_serial

  cleaned = [str(item).strip() for item in raw_entries if str(item).strip()]
  if not cleaned:
    return []

  machines = []
  seen_ports = set()
  ports_cache = None

  def known_ebb_devices():
    nonlocal ports_cache
    if ports_cache is None:
      ports_cache = ebb3_serial.list_ebb_ports() or []
    return ports_cache

  for label in cleaned:
    port = ebb3_serial.find_named(label)
    if not port:
      low = label.lower()
      if low.startswith("/dev/") or label.upper().startswith("COM"):
        for p in known_ebb_devices():
          if p[0] == label or p[0].lower() == low:
            port = p[0]
            break
    if not port or port in seen_ports:
      continue
    seen_ports.add(port)
    machines.append({"name": label, "port": port})

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
      parsed = machines_from_name_list(raw_list.splitlines())
    elif isinstance(raw_list, list):
      parsed = machines_from_name_list(raw_list)
    else:
      parsed = []

    emit({
      "machines": parsed
    })
  except Exception as error:
    fail(str(error))


if __name__ == "__main__":
  main()
