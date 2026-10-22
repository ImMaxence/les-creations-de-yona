// Only the version is bundled: esbuild drops the other fields of a JSON file imported by name.
import { version } from '../../../package.json';

/** Version of the front (package.json), shown in the back-office next to the backend's. */
export const FRONT_VERSION = version;
