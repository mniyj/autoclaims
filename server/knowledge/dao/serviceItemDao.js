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

export function getAllServiceItems() {
  return readCollection('service_items');
}

export function getServiceItemById(itemId) {
  const items = getAllServiceItems();
  return items.find(i => i.item_id === itemId);
}

export function getServiceItemsByCategory(category) {
  const items = getAllServiceItems();
  return items.filter(i => i.item_category === category);
}

export function search(query) {
  const items = getAllServiceItems();
  const lowerQuery = query.toLowerCase();
  return items.filter(i => 
    i.standard_name.toLowerCase().includes(lowerQuery) ||
    i.aliases.some(a => a.toLowerCase().includes(lowerQuery)) ||
    i.local_names.some(l => l.toLowerCase().includes(lowerQuery))
  );
}

export function saveServiceItem(item) {
  const items = getAllServiceItems();
  const index = items.findIndex(i => i.item_id === item.item_id);
  const now = new Date().toISOString();
  if (index >= 0) {
    items[index] = { ...item, updated_at: now };
  } else {
    item.created_at = now;
    item.updated_at = now;
    item.status = item.status || 'active';
    items.push(item);
  }
  writeCollection('service_items', items);
  return item;
}

export function deleteServiceItem(itemId) {
  const items = getAllServiceItems();
  const index = items.findIndex(i => i.item_id === itemId);
  if (index >= 0) {
    items.splice(index, 1);
    writeCollection('service_items', items);
    return true;
  }
  return false;
}

export default {
  getAllServiceItems,
  getServiceItemById,
  getServiceItemsByCategory,
  search,
  saveServiceItem,
  deleteServiceItem
};
