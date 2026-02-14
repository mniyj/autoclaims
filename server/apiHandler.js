import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OSS from 'ali-oss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'jsonlist');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const getFilePath = (resource) => path.join(dataDir, `${resource}.json`);

// Manual env loader to avoid process.env sync issues in vite dev
const loadEnvConfig = () => {
    const rootEnvPath = path.join(projectRoot, '.env.local');
    if (fs.existsSync(rootEnvPath)) {
        const content = fs.readFileSync(rootEnvPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let val = match[2].trim();
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                if (!process.env[key]) process.env[key] = val;
                // Always update these specific ones for real-time changes
                if (key.startsWith('ALIYUN_OSS_')) process.env[key] = val;
            }
        });
    }
};
loadEnvConfig();

const readData = (resource) => {
    const filePath = getFilePath(resource);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${resource}:`, error);
        return [];
    }
};

const writeData = (resource, data) => {
    const filePath = getFilePath(resource);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error writing ${resource}:`, error);
        return false;
    }
};

// ID field candidates for matching records
const ID_FIELDS = ['id', 'productCode', 'code', 'ruleset_id', 'field_id', 'reportNumber'];

const findItemIndex = (data, id) => {
    if (!Array.isArray(data)) return -1;
    return data.findIndex(item => {
        for (const field of ID_FIELDS) {
            if (item[field] !== undefined && String(item[field]) === String(id)) {
                return true;
            }
        }
        return false;
    });
};

// Parse request body helper (works with both raw and pre-parsed bodies)
const parseBody = (req) => {
    return new Promise((resolve, reject) => {
        // If body is already parsed (e.g. by express.json()), use it directly
        if (req.body !== undefined && req.body !== null) {
            resolve(req.body);
            return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
};

// Supported resources
const allowedResources = [
    'products',
    'clauses',
    'strategies',
    'companies',
    'industry-data',
    'insurance-types',
    'responsibilities',
    'claims-materials',
    'claim-items',
    'claim-cases',
    'rulesets',
    'product-claim-configs',
    'end-users',
    'users',
    'mapping-data',
];

export const handleApiRequest = async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/api\/([^/]+)(?:\/(.+))?$/);

    if (!match) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not Found' }));
        return;
    }

    const resource = match[1];
    const id = match[2] ? decodeURIComponent(match[2]) : null;

    if (resource === 'upload-token') {
        const config = {
            region: process.env.ALIYUN_OSS_REGION,
            accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
            bucket: process.env.ALIYUN_OSS_BUCKET
        };

        console.log('[API] Requested upload-token. Current Config:', {
            region: config.region,
            bucket: config.bucket,
            hasKeyId: !!config.accessKeyId,
            hasSecret: !!config.accessKeySecret
        });

        if (!config.accessKeyId) {
            console.error('[API] OSS credentials missing in process.env');
            res.statusCode = 500;
            res.end(JSON.stringify({
                error: 'OSS credentials not configured on server',
                hint: 'Please ensure .env.local in root is set and server restarted if needed.'
            }));
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(config));
        return;
    }

    if (resource === 'upload') {
        if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }

        try {
            const { fileName, fileType, base64 } = await parseBody(req);
            if (!base64) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing base64 data' }));
                return;
            }

            const config = {
                region: process.env.ALIYUN_OSS_REGION,
                accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
                accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
                bucket: process.env.ALIYUN_OSS_BUCKET
            };

            if (!config.accessKeyId) {
                throw new Error('OSS credentials not configured on server');
            }

            const client = new OSS(config);
            const buffer = Buffer.from(base64, 'base64');

            // Use generating a unique filename if none provided
            const finalFileName = fileName || `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

            console.log(`[API] Uploading to OSS via Proxy: ${finalFileName}`);
            const result = await client.put(finalFileName, buffer, {
                mime: fileType || 'image/jpeg'
            });

            res.setHeader('Content-Type', 'application/json');
            const signedUrl = client.signatureUrl(finalFileName, { expires: 3600 });
            res.end(JSON.stringify({ success: true, url: signedUrl, name: result.name, objectKey: finalFileName, publicUrl: result.url }));
        } catch (error) {
            console.error('[API] OSS Proxy Upload Failed:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Upload failed', message: error.message }));
        }
        return;
    }

    if (resource === 'oss-url') {
        if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }

        try {
            const key = url.searchParams.get('key');
            const expires = Number(url.searchParams.get('expires') || 3600);
            if (!key) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing key' }));
                return;
            }

            const config = {
                region: process.env.ALIYUN_OSS_REGION,
                accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
                accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
                bucket: process.env.ALIYUN_OSS_BUCKET
            };

            if (!config.accessKeyId) {
                throw new Error('OSS credentials not configured on server');
            }

            const client = new OSS(config);
            const signedUrl = client.signatureUrl(key, { expires });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, url: signedUrl }));
        } catch (error) {
            console.error('[API] OSS Signed URL Failed:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Signed URL failed', message: error.message }));
        }
        return;
    }

    if (!allowedResources.includes(resource)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: `Invalid Resource: ${resource}` }));
        return;
    }

    res.setHeader('Content-Type', 'application/json');

    try {
        if (req.method === 'GET') {
            const data = readData(resource);
            if (id) {
                const idx = findItemIndex(data, id);
                if (idx === -1) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Item not found' }));
                } else {
                    res.end(JSON.stringify(data[idx]));
                }
            } else {
                res.end(JSON.stringify(data));
            }
        } else if (req.method === 'POST') {
            const newItem = await parseBody(req);
            const data = readData(resource);
            data.push(newItem);
            writeData(resource, data);
            res.statusCode = 201;
            res.end(JSON.stringify({ success: true, data: newItem }));
        } else if (req.method === 'PUT') {
            const payload = await parseBody(req);
            if (id) {
                const data = readData(resource);
                const idx = findItemIndex(data, id);
                if (idx === -1) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Item not found' }));
                } else {
                    data[idx] = { ...data[idx], ...payload };
                    writeData(resource, data);
                    res.end(JSON.stringify({ success: true, data: data[idx] }));
                }
            } else {
                writeData(resource, payload);
                res.end(JSON.stringify({ success: true, count: Array.isArray(payload) ? payload.length : 1 }));
            }
        } else if (req.method === 'DELETE') {
            if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'DELETE requires an ID' }));
                return;
            }
            const data = readData(resource);
            const idx = findItemIndex(data, id);
            if (idx === -1) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Item not found' }));
            } else {
                const removed = data.splice(idx, 1)[0];
                writeData(resource, data);
                res.end(JSON.stringify({ success: true, data: removed }));
            }
        } else {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
    } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message || 'Bad Request' }));
    }
};
