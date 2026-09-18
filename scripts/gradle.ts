/**
 * Runs the Android Gradle wrapper from the repository root on any OS.
 *
 *   node scripts/gradle.ts assembleDebug
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const args = process.argv.slice(2);

// On Windows a .bat file must be started through cmd.exe. The full path avoids relying on
// cmd searching the current directory (disabled when NoDefaultCurrentDirectoryInExePath is set).
const result =
  process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec ?? 'cmd.exe',
        ['/d', '/s', '/c', `""${join(androidDir, 'gradlew.bat')}" ${args.join(' ')}"`],
        {
          cwd: androidDir,
          stdio: 'inherit',
          windowsVerbatimArguments: true,
        },
      )
    : spawnSync('./gradlew', args, { cwd: androidDir, stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
