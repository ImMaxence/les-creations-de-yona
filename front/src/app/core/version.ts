// Only the version is bundled: esbuild drops the other fields of a JSON file imported by name.
import { version } from '../../../package.json';

/** Version of the front (package.json), shown in the back-office next to the backend's. */
export const FRONT_VERSION = version;

/**
 * Whether the backend runs a newer version than this front ("1.14.0" against "1.13.2"): the page
 * was opened before a deployment. False for anything else, "dev" or an absent header included.
 */
export function isNewerThanFront(backendVersion: string | null | undefined, frontVersion = FRONT_VERSION): boolean {
  const backend = parts(backendVersion);
  const front = parts(frontVersion);
  if (!backend || !front) {
    return false;
  }
  for (let index = 0; index < 3; index++) {
    if (backend[index] !== front[index]) {
      return backend[index] > front[index];
    }
  }
  return false;
}

function parts(version: string | null | undefined): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version?.trim() ?? '');
  return match ? match.slice(1).map(Number) : null;
}
