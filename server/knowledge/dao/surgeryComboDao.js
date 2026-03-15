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

export function getAllSurgeryCombos() {
  return readCollection('surgery_combos');
}

export function getSurgeryComboById(relId) {
  const rels = getAllSurgeryCombos();
  return rels.find(r => r.rel_id === relId);
}

export function getSurgeryCombosBySurgery(surgeryItemId) {
  const rels = getAllSurgeryCombos();
  return rels.filter(r => r.surgery_item_id === surgeryItemId);
}

export function saveSurgeryCombo(rel) {
  const rels = getAllSurgeryCombos();
  const index = rels.findIndex(r => r.rel_id === rel.rel_id);
  if (index >= 0) {
    rels[index] = { ...rel, updated_at: new Date().toISOString() };
  } else {
    rel.created_at = new Date().toISOString();
    rel.updated_at = rel.created_at;
    rel.status = rel.status || 'active';
    rels.push(rel);
  }
  writeCollection('surgery_combos', rels);
  return rel;
}

export default {
  getAllSurgeryCombos,
  getSurgeryComboById,
  getSurgeryCombosBySurgery,
  saveSurgeryCombo
};
