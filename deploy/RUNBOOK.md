# StudyFlow → study.dmarka.eu (prod runbook)

Fully separate from the DMARKA stack: own dir, own compose project, own
volume. The only shared pieces are the docker network and the Caddy
reverse proxy (one extra site block).

## 0. DNS (one-time, manual — Websupport admin)

Add an **A record**: `study.dmarka.eu → 178.105.172.170` (TTL default).
Caddy issues the TLS certificate automatically once it resolves.

## 1. First install (as root on the prod box)

```sh
cd /opt
git clone https://github.com/Darok69/studyflow.git studyflow
cd studyflow
cp deploy/env.example .env
npx web-push generate-vapid-keys   # paste keys into .env

# Find the network Caddy is on (usually dmarka_default):
docker network ls | grep dmarka
# If it differs, fix `networks.web.name` in docker-compose.yml.

docker compose up -d --build
docker compose logs studyflow | grep "ADMIN ACCOUNT"   # one-time admin code!
```

## 2. Caddy site block (DMARKA stack)

Append `deploy/Caddyfile.snippet` to the DMARKA Caddyfile, then — because
of the single-file bind-mount inode trap — do NOT `caddy reload`:

```sh
cd /opt/dmarka && docker compose up -d --force-recreate caddy
```

## 3. Updates

```sh
cd /opt/studyflow && git pull && docker compose up -d --build
```

## 4. Backups

All state lives in the `studyflow-data` volume (JSON files: users,
sessions, per-user sync snapshots, push subscriptions). Include it in
borgmatic or dump it with:

```sh
docker run --rm -v studyflow_studyflow-data:/data -v /root:/out alpine \
  tar czf /out/studyflow-data.tgz -C /data .
```

## Notes

- The admin access code prints ONCE on first start (`ADMIN ACCOUNT CREATED`).
  Log in with it, then manage friends' access in Nastavení → Přístupy.
- User codes are shown once at creation; "Nový kód" invalidates the old one.
- The container serves the PWA shell publicly; all DATA endpoints require a
  session. Rate limiting is on the login endpoint.
