/**
 * Runs the Capacitor CLI (`node scripts/cap.ts run android`).
 *
 * The CLI starts `./gradlew` from the android/ folder. On Windows machines where
 * NoDefaultCurrentDirectoryInExePath is set, cmd.exe refuses to look in the current
 * directory and the build fails with "'gradlew' is not recognized"; the variable is
 * removed from the CLI's environment so the wrapper is found again.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require.resolve('@capacitor/cli/bin/capacitor');
const env = { ...process.env };
delete env.NoDefaultCurrentDirectoryInExePath;

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
