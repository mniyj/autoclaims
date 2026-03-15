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

export function getAllDosageRules() {
  return readCollection('dosage_rules');
}

export function getDosageRuleById(ruleId) {
  const rules = getAllDosageRules();
  return rules.find(r => r.rule_id === ruleId);
}

export function getDosageRulesByDrug(drugId) {
  const rules = getAllDosageRules();
  return rules.filter(r => r.object_id === drugId);
}

export function saveDosageRule(rule) {
  const rules = getAllDosageRules();
  const index = rules.findIndex(r => r.rule_id === rule.rule_id);
  const now = new Date().toISOString();
  if (index >= 0) {
    rules[index] = { ...rule, updated_at: now };
  } else {
    rule.created_at = now;
    rule.updated_at = now;
    rule.status = rule.status || 'active';
    rules.push(rule);
  }
  writeCollection('dosage_rules', rules);
  return rule;
}

export default {
  getAllDosageRules,
  getDosageRuleById,
  getDosageRulesByDrug,
  saveDosageRule
};
