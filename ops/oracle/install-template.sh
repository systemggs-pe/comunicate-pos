#!/bin/sh
set -eu
# Local Linux host changes only; no cloud API, network download or service activation.
if [ "${1:-}" != "--apply-local-host" ]; then
  printf '%s\n' 'PLAN ONLY: create restricted user/directories, install prepared units; no start/enable/deploy.'
  exit 0
fi
[ "$(id -u)" = 0 ] || { printf '%s\n' 'ROOT_REQUIRED'; exit 1; }
[ "$(uname -s)" = Linux ] || exit 1
[ "$(uname -m)" = aarch64 ] || { printf '%s\n' 'ARM64_REQUIRED'; exit 1; }
for unit in communicate-api.service communicate-worker.service communicate-worker.timer; do
  [ ! -e "/etc/systemd/system/$unit" ] || { printf '%s\n' 'EXISTING_UNIT_REQUIRES_MANUAL_REVIEW'; exit 1; }
done
command -v node >/dev/null
node -e 'if(Number(process.versions.node.split(".")[0])!==24)process.exit(1)'
id communicate >/dev/null 2>&1 || useradd --system --user-group --home-dir /opt/communicate --shell /usr/sbin/nologin communicate
install -d -o root -g communicate -m 0750 /etc/communicate /opt/communicate /opt/communicate/releases
install -d -o communicate -g communicate -m 0700 /var/lib/communicate
install -o root -g root -m 0644 ops/oracle/communicate-api.service /etc/systemd/system/
install -o root -g root -m 0644 ops/worker/communicate-worker.service ops/worker/communicate-worker.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/communicate-api.service /etc/systemd/system/communicate-worker.service /etc/systemd/system/communicate-worker.timer
printf '%s\n' 'PREPARED: review release, env, Node path, TLS and quotas; services remain disabled.'
