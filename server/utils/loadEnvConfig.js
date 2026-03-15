import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot() {
  const candidates = [
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', '..'),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, '.env.local'))) {
      return candidate;
    }
  }

  return candidates[0];
}

export function loadEnvConfig(options = {}) {
  const { forceKeys = [] } = options;
  const projectRoot = resolveProjectRoot();
  const envPath = path.join(projectRoot, '.env.local');

  if (!existsSync(envPath)) {
    return {
      loaded: false,
      envPath,
      projectRoot,
    };
  }

  const forceKeySet = new Set(forceKeys);
  const envContent = readFileSync(envPath, 'utf8');

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key] || forceKeySet.has(key)) {
      process.env[key] = value;
    }
  }

  return {
    loaded: true,
    envPath,
    projectRoot,
  };
}

export default loadEnvConfig;
