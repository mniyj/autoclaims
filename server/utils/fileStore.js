import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(projectRoot, 'jsonlist');

/**
 * 读取 JSON 数据文件
 * @param {string} resource - 资源名称
 * @returns {any[]} 数据数组
 */
export function readData(resource) {
    const filePath = path.join(dataDir, `${resource}.json`);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
        console.error(`Error reading ${resource}:`, err);
        return [];
    }
}

/**
 * 写入 JSON 数据文件
 * @param {string} resource - 资源名称
 * @param {any} data - 要写入的数据
 * @returns {boolean} 是否成功
 */
export function writeData(resource, data) {
    const filePath = path.join(dataDir, `${resource}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error(`Error writing ${resource}:`, err);
        return false;
    }
}
