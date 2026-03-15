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

export function getAllHospitals() {
  return readCollection('hospitals');
}

export function getHospitalById(hospitalId) {
  const hospitals = getAllHospitals();
  return hospitals.find(h => h.hospital_id === hospitalId);
}

export function getHospitalsByCity(province, city) {
  const hospitals = getAllHospitals();
  return hospitals.filter(h => h.province === province && h.city === city);
}

export function getHospitalsByLevel(level) {
  const hospitals = getAllHospitals();
  return hospitals.filter(h => h.level === level);
}

export function search(query) {
  const hospitals = getAllHospitals();
  const lowerQuery = query.toLowerCase();
  return hospitals.filter(h => 
    h.standard_name.toLowerCase().includes(lowerQuery) ||
    h.aliases.some(a => a.toLowerCase().includes(lowerQuery))
  );
}

export function saveHospital(hospital) {
  const hospitals = getAllHospitals();
  const index = hospitals.findIndex(h => h.hospital_id === hospital.hospital_id);
  const now = new Date().toISOString();
  if (index >= 0) {
    hospitals[index] = { ...hospital, updated_at: now };
  } else {
    hospital.created_at = now;
    hospital.updated_at = now;
    hospital.status = hospital.status || 'active';
    hospitals.push(hospital);
  }
  writeCollection('hospitals', hospitals);
  return hospital;
}

export function deleteHospital(hospitalId) {
  const hospitals = getAllHospitals();
  const nextHospitals = hospitals.filter((h) => h.hospital_id !== hospitalId);
  writeCollection('hospitals', nextHospitals);
}

export default {
  getAllHospitals,
  getHospitalById,
  getHospitalsByCity,
  getHospitalsByLevel,
  search,
  saveHospital,
  deleteHospital,
};
