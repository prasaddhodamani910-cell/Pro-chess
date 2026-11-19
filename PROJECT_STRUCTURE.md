# Project structure and maintenance

This repository contains several related chess applications. Keep each product's source and build configuration inside its existing application directory; the root `scripts/` directory contains the shared screenshot recognition and web workflow.

## Source map

| Location | Purpose |
| --- | --- |
| `scripts/` | Shared Python recognition pipeline, board utilities, web server, and command-line scripts |
| `scripts/dev/` | Development and inspection helpers; not part of the normal user workflow |
| `ai/` | AI recognition implementation and checks |
| `desktop_app/src/` | Desktop application Python source and assets |
| `android_app/app/src/` | Android application source, resources, and bundled web assets |
| `prasadchessengine/src/` | C++ chess engine source |
| `prasadchessengine/gui/` | Engine web interface source |
| `assets/`, `doc/` | Project media and design/implementation documentation |
| `output/` | Generated recognition output and preview images |

## Project root

- `README.md` is the entry point with launch instructions and links to product guides.
- `requirements.txt` lists Python dependencies for the root workflow. App-specific dependencies stay beside their app.
- `run_pc.bat` and `run_chessmod_pc.bat` are root-level Windows launchers.
- `all_code.txt` is a generated concatenation of source files; edit the individual source files instead.
- `bin/` contains the root workflow's bundled engine executable.

## Keeping files organized

- Put new shared Python modules and scripts in `scripts/`; put one-off developer helpers in `scripts/dev/`.
- Keep desktop, Android, and C++ engine code in their respective directories. Do not relocate generated embedded headers or app assets without updating the build steps that consume them.
- Put design notes in `doc/` and generated screenshots/previews in `output/`.
- Keep build outputs in the app's existing `build/` or `dist/` directories; avoid mixing compiled dependencies with source files.
- Update the relevant app README when a build command, launch path, dependency, or source responsibility changes. Add dated user-visible changes to `CHANGELOG.md`.
- Keep machine-specific SDK paths and signing material local; do not publish private signing keys.

