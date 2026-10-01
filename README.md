# Ctrl+Z-inMDT

A standalone JS mod for [Mindustry](https://github.com/Anuken/Mindustry) that lets you undo your own actions in-game with **Ctrl+Z**.

## Features

- Records every block **placement** and **removal** as one event, and `Ctrl+Z` steps back through them one at a time; **multiple builds/deletes on the same tile roll back layer by layer**.
- Restores a block's full internal state on undo — **inventory items, liquids, rotation, configuration, and health** — with zero loss.
- In-game settings panel (Chinese): master switch, undo limit, record placements, record overwritten blocks, undo hint toggle, and hint text size.

## Installation

1. Download [ctrl-z-in-mdt.zip](../../raw/main/ctrl-z-in-mdt.zip) or grab it from [Releases](../../releases).
2. Open Mindustry → Mods → Import Mod, and select the zip.
3. In a save, press `Ctrl+Z` to undo. The settings entry is under **Settings → 撤销**.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Enable undo | on | Master switch for the mod; no need to uninstall to disable it |
| Undo limit | 100 | Max operations remembered (10–1000); larger values may slightly affect performance |
| Record placements | on | Whether placements are recorded; removals are always recorded |
| Record overwritten blocks | on | Whether overwritten blocks can be restored by undo (recommended) |
| Show hint on undo | on | Whether a floating text hint appears on undo |
| Hint text size | 100% | Hint text scale (50%–200%) |

## Known issues

- Some mods provide "quick build / quick delete" features that bypass the vanilla removal flow, which **may occasionally cause incomplete recording or bugs**.

## Development

- Pack script: `pack-undo-delete.ps1` (produces a zip containing the `ctrl-z-in-mdt/` mod root, ready to import).

## License

[MIT](LICENSE)
