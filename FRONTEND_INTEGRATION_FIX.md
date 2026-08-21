# Latest frontend integration fix

This package already contains the August 21 frontend merged into the full
HajjMart application.

## What caused the replacement problem

The standalone frontend archive intentionally does not contain generated
dependencies (`Frontend/node_modules`) or the machine-local environment file
(`Frontend/.env.local`). Deleting the previous `Frontend` directory before
copying the new one therefore removes both. The frontend dependency versions
and lockfile did not change, but the packages still need to exist locally.

`dev1.sh` now:

- validates that the replacement contains the required frontend files;
- recreates `Frontend/.env.local`, even if a file manager skipped dotfiles;
- detects missing or stale frontend dependencies;
- uses the local npm cache when possible and installs from the public npm
  registry when necessary; and
- reports whether the install is happening because `node_modules` disappeared.

## Run

From this package's root:

```bash
chmod +x dev1.sh
./dev1.sh
```

The first run after a complete frontend replacement may need internet access
to reinstall npm dependencies. Requirements remain PHP 8.2+ with `pdo_mysql`,
Composer 2, Node.js 20+, npm, and either Docker Compose or a reachable MySQL
database.

For a future frontend-only update, preserve `Frontend/.env.local` and
`Frontend/node_modules` when the dependency manifests have not changed. Copying
the new `src/` and `public/` trees over the existing frontend is sufficient for
this specific August 21 update.
