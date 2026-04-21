# MVPT — remote plotting dashboard

Small **Node** web app that runs on the machine attached to your plotter. It talks to hardware through **Python** scripts (preview, plot, discover, commands). Use it on your LAN from a browser; tested mainly on macOS.

![UI](https://raw.githubusercontent.com/revdancatt/remote-plotting/master/README-imgs/ui.png?token=GHSAT0AAAAAACBGWLNWNW7IITEBH6QPZKOKZB6SOFQ)

---

## Install (short version)

1. **Node.js 20+** — `node -v`
2. **Python 3** with the **`nextdraw`** package importable from that interpreter (same stack as Bantam Tools / NextDraw Python API — if `python3 -c "from nextdraw import NextDraw"` fails, install/fix that first).
3. Clone, then:

   ```bash
   cd remote-plotting
   npm install
   cp .env.example .env
   ```

4. Edit **`.env`**. Minimum:

   | Variable | What |
   |----------|------|
   | `SVGDIR` | Absolute path to the folder of SVGs the UI should browse (required). |
   | `PYTHON_BIN` | Optional; default `python3`. Must run the env where `nextdraw` is installed. |

   Other keys in `.env.example` set defaults, virtual preview machines for testing, webhook, etc.

5. **Run:** `npm start` → open `http://localhost:2000` (or your `PORT`).

**Dev:** `npm run dev` (nodemon).

---

## Usage (very short)

Discover machines, pick an SVG from the library, assign it to a machine panel, **Preview** then **Plot**. Real hardware and optional **virtual** machines are supported.

---

## Heads-up

This is a personal tool with light guardrails. Don’t expose it raw to the internet. Avoid running the server under a process manager that breaks clean child processes if plotting acts up — `npm start` directly is the simple path.

---

## License

MIT — see [LICENSE](LICENSE).
