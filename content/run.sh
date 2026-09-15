#!/bin/sh
# Jeden vstupní bod pro všechny předměty:
#
#   ./run.sh irewi                  render slidů + textová vrstva + REPORT
#   ./run.sh irewi --only IL01      jen vybrané přednášky
#   ./run.sh pravni-dejiny slides   totéž, když chceš krok pojmenovat
#   ./run.sh irewi merge content/content_IL01.json
#   ./run.sh irewi materials        balíček pro obrazovku Učebnice
#   ./run.sh irewi deck             balíček karet pro Import
#   ./run.sh irewi audio --series quiz
#   ./run.sh irewi feed --base https://study.dmarka.eu --token <token>
#
# Závislosti si stáhne uv sám podle hlaviček v jednotlivých skriptech.
set -e
here=$(cd "$(dirname "$0")" && pwd)

pack=$1
if [ -z "$pack" ]; then
  echo "Použití: ./run.sh <předmět> [krok] [volby]" >&2
  echo "Předměty: $(ls -d "$here"/*/courses.json 2>/dev/null | xargs -n1 dirname | xargs -n1 basename | tr '\n' ' ')" >&2
  exit 2
fi
shift

case "$1" in
  slides|"") script=run.py ;;
  merge)     script=merge_content.py ;;
  materials) script=make_materials.py ;;
  deck)      script=make_deck.py ;;
  backup)    script=make_backup.py ;;
  audio)     script=make_audio.py ;;
  feed)      script=make_feed.py ;;
  *)         script=run.py ;;          # ./run.sh irewi --only IL01
esac
case "$1" in
  slides|merge|materials|deck|backup|audio|feed) shift ;;
esac

export STUDYFLOW_PACK="$pack"
exec uv run "$here/pipeline/$script" "$@"
