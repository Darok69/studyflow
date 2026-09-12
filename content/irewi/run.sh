#!/bin/sh
# Celé zpracování jedním příkazem. Závislosti si stáhne uv sám (PEP 723).
exec uv run "$(dirname "$0")/pipeline/run.py" "$@"
