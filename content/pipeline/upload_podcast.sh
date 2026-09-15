#!/bin/sh
# Nahraje hotové epizody, feed a obal do produkčního svazku.
#
# Data NEJSOU na disku hostitele — jsou v pojmenovaném dockerovém svazku, takže
# se tar streamuje rovnou do kontejneru. COPYFILE_DISABLE brání tomu, aby macOS
# přibalil své ._soubory (jednou už takový ve /data skončil).
#
# Použití:  ./run.sh <předmět> upload <quiz|narration>
set -eu

HOST="${STUDYFLOW_HOST:-root@178.105.172.170}"
KEY="${STUDYFLOW_KEY:-$HOME/.ssh/dmarka_prod}"
PACK="${STUDYFLOW_PACK:-}"
[ -n "$PACK" ] || { echo "není zvolený předmět — pusť ./run.sh <předmět> upload <řada>" >&2; exit 2; }

AUDIO="$(cd "$(dirname "$0")/../$PACK/out/audio" 2>/dev/null && pwd)" || {
  echo "předmět $PACK nemá out/audio — pusť nejdřív ./run.sh $PACK audio --series <řada>" >&2; exit 1; }

SERIES="${1:-}"
[ -n "$SERIES" ] || { echo "použití: ./run.sh <předmět> upload <quiz|narration>" >&2; exit 2; }
[ -f "$AUDIO/$SERIES/feed.xml" ] || { echo "chybí $SERIES/feed.xml — pusť nejdřív ./run.sh $PACK feed …" >&2; exit 1; }

# Adresa feedu je zapsaná v odběru, proto IREWI zůstává u holých jmen řad
# (quiz, narration) a další předměty mají vlastní pořad s prefixem.
if [ "$PACK" = "irewi" ]; then REMOTE="$SERIES"; else REMOTE="$PACK-$SERIES"; fi

echo "balím $SERIES → /data/podcast/$REMOTE…"
COPYFILE_DISABLE=1 tar -cz -C "$AUDIO" \
  --exclude '*.txt' --exclude '*.stamp' --exclude '.DS_Store' \
  -s "|^$SERIES|$REMOTE|" \
  "$SERIES" | \
  ssh -i "$KEY" "$HOST" 'docker exec -i studyflow sh -c "mkdir -p /data/podcast && tar -xz -C /data/podcast"'

echo "na serveru:"
ssh -i "$KEY" "$HOST" "docker exec studyflow sh -c 'ls /data/podcast/$REMOTE | wc -l; du -sh /data/podcast/$REMOTE'"
