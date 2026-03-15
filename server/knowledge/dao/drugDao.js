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

export function getAllDrugs() {
  return readCollection('drugs');
}

export function getDrugById(drugId) {
  const drugs = getAllDrugs();
  return drugs.find(d => d.drug_id === drugId);
}

export function getDrugsByGenericName(genericName) {
  const drugs = getAllDrugs();
  return drugs.filter(d => d.generic_name.includes(genericName));
}

export function getDrugsByNhsaCode(nhsaCode) {
  const drugs = getAllDrugs();
  return drugs.filter(d => d.nhsa_code === nhsaCode);
}

export function search(query) {
  const drugs = getAllDrugs();
  const lowerQuery = query.toLowerCase();
  return drugs.filter(d => 
    d.generic_name.toLowerCase().includes(lowerQuery) ||
    (d.brand_name && d.brand_name.toLowerCase().includes(lowerQuery)) ||
    d.aliases.some(a => a.toLowerCase().includes(lowerQuery))
  );
}

export function saveDrug(drug) {
  const drugs = getAllDrugs();
  const index = drugs.findIndex(d => d.drug_id === drug.drug_id);
  const now = new Date().toISOString();
  if (index >= 0) {
    drugs[index] = { ...drug, updated_at: now };
  } else {
    drug.created_at = now;
    drug.updated_at = now;
    drug.status = drug.status || 'active';
    drugs.push(drug);
  }
  writeCollection('drugs', drugs);
  return drug;
}

export function deleteDrug(drugId) {
  const drugs = getAllDrugs();
  const index = drugs.findIndex(d => d.drug_id === drugId);
  if (index >= 0) {
    drugs.splice(index, 1);
    writeCollection('drugs', drugs);
    return true;
  }
  return false;
}

export function getActiveDrugs() {
  return getAllDrugs().filter(d => d.status === 'active');
}

export default {
  getAllDrugs,
  getDrugById,
  getDrugsByGenericName,
  getDrugsByNhsaCode,
  search,
  saveDrug,
  deleteDrug,
  getActiveDrugs
};
