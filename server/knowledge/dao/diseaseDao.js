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

export function getAllDiseases() {
  return readCollection('diseases');
}

export function getDiseaseById(diseaseId) {
  const diseases = getAllDiseases();
  return diseases.find(d => d.disease_id === diseaseId);
}

export function getDiseaseByIcdCode(icdCode) {
  const diseases = getAllDiseases();
  return diseases.find(d => d.icd_code === icdCode);
}

export function search(query) {
  const diseases = getAllDiseases();
  const lowerQuery = query.toLowerCase();
  return diseases.filter(d =>
    d.standard_name.toLowerCase().includes(lowerQuery) ||
    d.aliases.some(a => a.toLowerCase().includes(lowerQuery))
  );
}

export function saveDisease(disease) {
  const diseases = getAllDiseases();
  const index = diseases.findIndex(d => d.disease_id === disease.disease_id);
  const now = new Date().toISOString();
  if (index >= 0) {
    diseases[index] = { ...disease, updated_at: now };
  } else {
    disease.created_at = now;
    disease.updated_at = now;
    disease.status = disease.status || 'active';
    diseases.push(disease);
  }
  writeCollection('diseases', diseases);
  return disease;
}

export function deleteDisease(diseaseId) {
  const diseases = getAllDiseases();
  const nextDiseases = diseases.filter((d) => d.disease_id !== diseaseId);
  writeCollection('diseases', nextDiseases);
}

export default {
  getAllDiseases,
  getDiseaseById,
  getDiseaseByIcdCode,
  search,
  saveDisease,
  deleteDisease,
};
