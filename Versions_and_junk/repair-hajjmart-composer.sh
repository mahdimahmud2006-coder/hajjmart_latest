#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_DIR="${1:-Backend}"
BACKEND_DIR="$(cd "$BACKEND_DIR" && pwd)"
COMPOSER_PHAR="$BACKEND_DIR/composer.phar"
INSTALLER="$BACKEND_DIR/.composer-setup.php"
BUILD_DIR="$BACKEND_DIR/vendor.build.$$"
BACKUP_DIR="$BACKEND_DIR/vendor.backup.$$"

cleanup() {
    rm -f "$INSTALLER"
    rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

command -v php >/dev/null || { echo "ERROR: php is required" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl is required" >&2; exit 1; }

if [ ! -f "$COMPOSER_PHAR" ] || ! php "$COMPOSER_PHAR" --version >/dev/null 2>&1; then
    echo "Downloading verified project-local Composer..."
    expected="$(curl -fsSL https://composer.github.io/installer.sig)"
    curl -fsSL https://getcomposer.org/installer -o "$INSTALLER"
    actual="$(php -r 'echo hash_file("sha384", $argv[1]);' "$INSTALLER")"
    [ "$expected" = "$actual" ] || { echo "ERROR: Composer installer signature mismatch" >&2; exit 1; }
    php "$INSTALLER" --quiet --install-dir="$BACKEND_DIR" --filename=composer.phar
    rm -f "$INSTALLER"
fi

rm -rf "$BUILD_DIR" "$BACKUP_DIR"
echo "Building a completely fresh vendor tree..."
(
    cd "$BACKEND_DIR"
    COMPOSER_VENDOR_DIR="$BUILD_DIR" \
    COMPOSER_MAX_PARALLEL_HTTP=1 \
    COMPOSER_MAX_PARALLEL_PROCESS=1 \
    php "$COMPOSER_PHAR" install --no-interaction --prefer-dist --no-scripts --no-progress
)

[ -f "$BUILD_DIR/autoload.php" ] || { echo "ERROR: staged autoload.php missing" >&2; exit 1; }
[ -f "$BUILD_DIR/composer/installed.php" ] || { echo "ERROR: staged composer/installed.php missing" >&2; exit 1; }

echo "Staged vendor tree verified. Swapping it into place..."
if [ -d "$BACKEND_DIR/vendor" ]; then
    mv "$BACKEND_DIR/vendor" "$BACKUP_DIR"
fi
mv "$BUILD_DIR" "$BACKEND_DIR/vendor"

if ! (cd "$BACKEND_DIR" && php "$COMPOSER_PHAR" dump-autoload --optimize --no-interaction); then
    echo "Autoload generation failed; restoring previous vendor tree." >&2
    rm -rf "$BACKEND_DIR/vendor"
    [ ! -d "$BACKUP_DIR" ] || mv "$BACKUP_DIR" "$BACKEND_DIR/vendor"
    exit 1
fi

rm -rf "$BACKUP_DIR"
trap - EXIT
rm -f "$INSTALLER"

echo "OK: vendor/autoload.php"
test -f "$BACKEND_DIR/vendor/autoload.php"
echo "OK: vendor/composer/installed.php"
test -f "$BACKEND_DIR/vendor/composer/installed.php"
echo "Composer repair complete. Run: ./dev1.sh"
