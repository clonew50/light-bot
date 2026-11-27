import * as baileys from 'baileys';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

global.baileys = baileys;

if (typeof global.__filename !== 'function') {
	global.__filename = function filename(pathURL = import.meta.url, rmPrefix = process.platform !== 'win32') {
		if (rmPrefix) return /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL;
		return pathToFileURL(pathURL).toString();
	};
}

if (typeof global.__dirname !== 'function') {
	global.__dirname = function dirname(pathURL) {
		return path.dirname(global.__filename(pathURL, true));
	};
}

if (typeof global.__require !== 'function') {
	global.__require = function require(dir = import.meta.url) {
		return createRequire(dir);
	};
}

export default baileys;

// Hi
