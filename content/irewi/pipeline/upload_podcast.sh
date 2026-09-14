#!/bin/sh
# Nahraje hotové epizody, feed a obal do produkčního svazku.
#
# Data NEJSOU na disku hostitele — jsou v pojmenovaném dockerovém svazku, takže
# se tar streamuje rovnou do kontejneru. COPYFILE_DISABLE brání tomu, aby macOS
# přibalil své ._soubory (jednou už takový ve /data skončil).
set -eu

HOST="${STUDYFLOW_HOST:-root@178.105.172.170}"
KEY="${STUDYFLOW_KEY:-$HOME/.ssh/dmarka_prod}"
AUDIO="$(cd "$(dirname "$0")/../out/audio" && pwd)"

SERIES="${1:-}"
[ -n "$SERIES" ] || { echo "použití: $0 <quiz|narration>" >&2; exit 2; }
[ -f "$AUDIO/$SERIES/feed.xml" ] || { echo "chybí $SERIES/feed.xml — pusť nejdřív make_feed.py" >&2; exit 1; }

echo "balím $SERIES…"
COPYFILE_DISABLE=1 tar -cz -C "$AUDIO" \
  --exclude '*.txt' --exclude '*.stamp' --exclude '.DS_Store' \
  "$SERIES" | \
  ssh -i "$KEY" "$HOST" 'docker exec -i studyflow sh -c "mkdir -p /data/podcast && tar -xz -C /data/podcast"'

echo "na serveru:"
ssh -i "$KEY" "$HOST" "docker exec studyflow sh -c 'ls /data/podcast/$SERIES | wc -l; du -sh /data/podcast/$SERIES'"
