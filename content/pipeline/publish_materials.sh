#!/bin/sh
# Nahraje učebnici předmětu do produkčního svazku.
#
# Rejstřík se nahrává pod jménem index-<předmět>.json, aby se předměty
# nepřepisovaly — server si z nich poskládá jeden seznam kurzů.
# Soubory přednášek a obrázky mají v názvu ID přednášky, takže si nekolidují.
#
# Použití:  ./run.sh <předmět> publish
set -eu

HOST="${STUDYFLOW_HOST:-root@178.105.172.170}"
KEY="${STUDYFLOW_KEY:-$HOME/.ssh/dmarka_prod}"
PACK="${STUDYFLOW_PACK:-}"
[ -n "$PACK" ] || { echo "není zvolený předmět" >&2; exit 2; }

ROOT="$(cd "$(dirname "$0")/../$PACK" && pwd)"
[ -f "$ROOT/out/materials/index.json" ] || {
  echo "chybí out/materials — pusť nejdřív ./run.sh $PACK materials" >&2; exit 1; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/materials"
cp "$ROOT"/out/materials/*.json "$STAGE/materials/"
mv "$STAGE/materials/index.json" "$STAGE/materials/index-$PACK.json"
# Obrázky jen k přednáškám, které v učebnici opravdu jsou.
for f in "$ROOT"/out/materials/*.json; do
  id=$(basename "$f" .json)
  [ "$id" = "index-$PACK" ] && continue
  [ -d "$ROOT/out/img/$id" ] && cp -R "$ROOT/out/img/$id" "$STAGE/materials/img/$id" 2>/dev/null || {
    mkdir -p "$STAGE/materials/img"; [ -d "$ROOT/out/img/$id" ] && cp -R "$ROOT/out/img/$id" "$STAGE/materials/img/$id"; }
done

echo "nahrávám $PACK: $(ls "$STAGE/materials"/*.json | wc -l | tr -d ' ') souborů, $(du -sh "$STAGE/materials" | cut -f1)"
COPYFILE_DISABLE=1 tar -cz -C "$STAGE" --exclude '.DS_Store' materials | \
  ssh -i "$KEY" "$HOST" 'docker exec -i studyflow sh -c "tar -xz -C /data"'

echo "na serveru:"
ssh -i "$KEY" "$HOST" "docker exec studyflow sh -c 'ls /data/materials/index-*.json; du -sh /data/materials'"
