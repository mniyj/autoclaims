import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../jsonlist/knowledge');

function ensureDataDir() {
  const dir = path.join(DATA_DIR, 'processed');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFilePath(collection) {
  return path.join(ensureDataDir(), `${collection}.json`);
}

function readCollection(collection) {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeCollection(collection, data) {
  const filePath = getFilePath(collection);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getAllAliases() {
  return readCollection('aliases');
}

export function getAliasById(aliasId) {
  const aliases = getAllAliases();
  return aliases.find(a => a.alias_id === aliasId);
}

export function findAliasByText(aliasText, entityType = null) {
  const aliases = getAllAliases();
  return aliases.filter(a => 
    a.alias_text === aliasText &&
    (!entityType || a.entity_type === entityType)
  );
}

export function findAliasesByEntity(entityType, entityId) {
  const aliases = getAllAliases();
  return aliases.filter(a => 
    a.entity_type === entityType && 
    a.entity_id === entityId
  );
}

export function searchAliases(query, entityType = null) {
  const aliases = getAllAliases();
  const lowerQuery = query.toLowerCase();
  return aliases.filter(a => 
    a.alias_text.toLowerCase().includes(lowerQuery) &&
    (!entityType || a.entity_type === entityType)
  );
}

export function saveAlias(alias) {
  const aliases = getAllAliases();
  const index = aliases.findIndex(a => a.alias_id === alias.alias_id);
  const now = new Date().toISOString();
  if (index >= 0) {
    aliases[index] = { ...alias, updated_at: now };
  } else {
    alias.created_at = now;
    alias.updated_at = now;
    alias.status = alias.status || 'active';
    aliases.push(alias);
  }
  writeCollection('aliases', aliases);
  return alias;
}

export function deleteAlias(aliasId) {
  const aliases = getAllAliases();
  const index = aliases.findIndex(a => a.alias_id === aliasId);
  if (index >= 0) {
    aliases.splice(index, 1);
    writeCollection('aliases', aliases);
    return true;
  }
  return false;
}

export function getActiveAliases() {
  return getAllAliases().filter(a => a.status === 'active');
}

export default {
  getAllAliases,
  getAliasById,
  findAliasByText,
  findAliasesByEntity,
  searchAliases,
  saveAlias,
  deleteAlias,
  getActiveAliases
};
