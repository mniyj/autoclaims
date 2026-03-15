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

export function getAllDiseaseServiceRels() {
  return readCollection('disease_service_rels');
}

export function getDiseaseServiceRelById(relId) {
  const rels = getAllDiseaseServiceRels();
  return rels.find(r => r.rel_id === relId);
}

export function getDiseaseServiceRelsByDisease(diseaseId) {
  const rels = getAllDiseaseServiceRels();
  return rels.filter(r => r.disease_id === diseaseId);
}

export function getDiseaseServiceRelsByItem(itemId) {
  const rels = getAllDiseaseServiceRels();
  return rels.filter(r => r.item_id === itemId);
}

export function saveDiseaseServiceRel(rel) {
  const rels = getAllDiseaseServiceRels();
  const index = rels.findIndex(r => r.rel_id === rel.rel_id);
  if (index >= 0) {
    rels[index] = { ...rel, updated_at: new Date().toISOString() };
  } else {
    rel.created_at = new Date().toISOString();
    rel.updated_at = rel.created_at;
    rel.status = rel.status || 'active';
    rels.push(rel);
  }
  writeCollection('disease_service_rels', rels);
  return rel;
}

export default {
  getAllDiseaseServiceRels,
  getDiseaseServiceRelById,
  getDiseaseServiceRelsByDisease,
  getDiseaseServiceRelsByItem,
  saveDiseaseServiceRel
};
