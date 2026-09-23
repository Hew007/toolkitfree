import fs from 'node:fs';

// Every tarball in the lockfile must resolve against the public registry.
//
// npm writes `resolved` from whichever registry it fetched from, so installing
// on a machine configured for a mirror quietly pins the lockfile to that mirror.
// Every environment that cannot reach it then fails a clean `npm ci` — this
// happened with 823 entries pinned to registry.npmmirror.com, which a
// restricted network rejects outright.
//
// Using a mirror locally is fine: the tarballs are identical, so the integrity
// hashes do not change. Rewrite the hosts before committing:
//   sed -i 's#https://registry.npmmirror.com/#https://registry.npmjs.org/#g' package-lock.json
const allowedPrefix = 'https://registry.npmjs.org/';
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

const offenders = Object.entries(lock.packages ?? {})
  .filter(([, entry]) => typeof entry.resolved === 'string')
  .filter(([, entry]) => !entry.resolved.startsWith(allowedPrefix))
  .map(([name, entry]) => ({ name: name || '(root)', host: new URL(entry.resolved).host }));

if (offenders.length > 0) {
  const hosts = [...new Set(offenders.map((offender) => offender.host))];
  throw new Error(
    `${offenders.length} lockfile entries resolve outside ${allowedPrefix} (${hosts.join(', ')}). ` +
      `First: ${offenders[0].name}`
  );
}

console.log(
  JSON.stringify({
    status: 'LOCKFILE_REGISTRY_OK',
    resolved: Object.values(lock.packages ?? {}).filter((entry) => entry.resolved).length,
  })
);
