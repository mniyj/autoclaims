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

export function getAllPolicyCoverageRels() {
  return readCollection('policy_coverage_rels');
}

export function getPolicyCoverageRelById(relId) {
  const rels = getAllPolicyCoverageRels();
  return rels.find(r => r.rel_id === relId);
}

export function getPolicyCoverageRelsByProduct(productId) {
  const rels = getAllPolicyCoverageRels();
  return rels.filter(r => r.product_id === productId);
}

export function savePolicyCoverageRel(rel) {
  const rels = getAllPolicyCoverageRels();
  const index = rels.findIndex(r => r.rel_id === rel.rel_id);
  if (index >= 0) {
    rels[index] = { ...rel, updated_at: new Date().toISOString() };
  } else {
    rel.created_at = new Date().toISOString();
    rel.updated_at = rel.created_at;
    rel.status = rel.status || 'active';
    rels.push(rel);
  }
  writeCollection('policy_coverage_rels', rels);
  return rel;
}

export default {
  getAllPolicyCoverageRels,
  getPolicyCoverageRelById,
  getPolicyCoverageRelsByProduct,
  savePolicyCoverageRel
};
