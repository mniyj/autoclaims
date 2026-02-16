import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OSS from 'ali-oss';
import { GoogleGenAI } from '@google/genai';

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

const GLM_OCR_URL = 'https://open.bigmodel.cn/api/paas/v4/layout_parsing';
const GLM_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
// RapidOCR 服务地址（启动: python server/paddle_ocr_server.py）
const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8866/predict/ocr_system';

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

const formatErrorMessage = (error) => {
    if (error instanceof Error) {
        const causeMessage = error.cause instanceof Error ? error.cause.message : '';
        return causeMessage ? `${error.message} | Cause: ${causeMessage}` : error.message;
    }
    return 'Unknown error';
};

const extractJsonFromText = (text) => {
    if (!text || typeof text !== 'string') return '';
    const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
        return cleaned.slice(first, last + 1);
    }
    return cleaned;
};

const callGlmChat = async ({ apiKey, model, messages, temperature = 0 }) => {
    const response = await fetch(GLM_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GLM Chat Failed: ${errorText}`);
    }

    return response.json();
};

const hasInlineData = (contents) => {
    const parts = Array.isArray(contents?.parts) ? contents.parts : [];
    return parts.some(part => part && typeof part === 'object' && part.inlineData);
};

const getGeminiModelCandidates = (requested, contents) => {
    const candidates = [];
    if (requested) candidates.push(requested);
    const envDefault = process.env.GEMINI_MODEL || process.env.DEFAULT_GEMINI_MODEL;
    if (envDefault && !candidates.includes(envDefault)) candidates.push(envDefault);
    const visionFallbacks = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    const textFallbacks = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    const fallbackList = hasInlineData(contents) ? visionFallbacks : textFallbacks;
    fallbackList.forEach(model => {
        if (!candidates.includes(model)) candidates.push(model);
    });
    return candidates;
};

const callGemini = async ({ model, contents, temperature = 0.1 }) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('Gemini API Key not found');
    }
    const ai = new GoogleGenAI({ apiKey });
    const candidates = getGeminiModelCandidates(model, contents);
    let lastError;
    for (const candidate of candidates) {
        try {
            const response = await ai.models.generateContent({
                model: candidate,
                contents,
                config: {
                    responseMimeType: 'application/json',
                    temperature
                }
            });
            return response;
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`Gemini request failed: ${formatErrorMessage(lastError)}`);
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
    'medical-insurance-catalog',  // 医保目录
    'hospital-info',              // 医院信息
    'invoice-audits',             // 发票审核记录
    'user-operation-logs',        // 用户操作日志
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

    if (resource === 'invoice-ocr') {
        if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }

        try {
            const { mode, base64Data, mimeType, prompt, geminiModel, invoiceSchema } = await parseBody(req);
            if (!base64Data || !mimeType) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing base64 data or mimeType' }));
                return;
            }

            // PaddleOCR 模式
            if (mode === 'paddle-ocr') {
                const ocrStartTime = Date.now();
                let paddleResponse;
                try {
                    paddleResponse = await fetch(PADDLE_OCR_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            images: [`data:${mimeType};base64,${base64Data}`]
                        })
                    });
                } catch (error) {
                    res.statusCode = 502;
                    res.end(JSON.stringify({ error: `Paddle OCR fetch failed: ${formatErrorMessage(error)}` }));
                    return;
                }

                if (!paddleResponse.ok) {
                    const errorText = await paddleResponse.text();
                    res.statusCode = paddleResponse.status;
                    res.end(JSON.stringify({ error: `Paddle OCR Failed: ${errorText}` }));
                    return;
                }

                const paddleResult = await paddleResponse.json();
                const ocrDuration = Date.now() - ocrStartTime;
                
                // Paddle OCR 返回结果格式: { results: [{ data: [{ text, confidence, text_region }] }] }
                const ocrTexts = (paddleResult.results?.[0]?.data || []).map(item => item.text).filter(Boolean);
                const ocrText = ocrTexts.join('\n');

                const schemaText = JSON.stringify(invoiceSchema || {}, null, 2);
                const parsePrompt = `以下是中国医疗发票的 OCR 识别结果。请从中提取结构化信息。

## 重要规则
1. 只提取 OCR 文本中**明确存在**的信息，严禁补充或编造
2. 费用明细项目**不要重复**，同一项目只提取一次
3. 注意区分"个人自付"(personalSelfPayment)和"个人自费"(personalSelfExpense)
4. 医院名称优先从票面印刷文字提取
5. 只返回 JSON，不要使用代码块或多余文字

## OCR 原文
${ocrText}

## 输出 JSON 格式
${schemaText}

## 输出规范
- 日期格式：YYYY-MM-DD
- 数字字段：纯数字，不含货币符号或千分位逗号
- 无法识别的字段：字符串用 ""，数字用 0`;

                const parsingStartTime = Date.now();
                const parseResponse = await callGemini({
                    model: geminiModel || 'gemini-2.5-flash',
                    contents: { parts: [{ text: parsePrompt }] },
                    temperature: 0
                });
                const parsingDuration = Date.now() - parsingStartTime;

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    text: parseResponse.text || '{}',
                    usageMetadata: {
                        ocr: { textLength: ocrText.length },
                        parsing: parseResponse.usageMetadata
                    },
                    timing: {
                        ocrDuration,
                        parsingDuration,
                        totalDuration: ocrDuration + parsingDuration
                    }
                }));
                return;
            }

            if (mode === 'glm-ocr' || mode === 'glm-ocr-structured') {
                const glmApiKey = process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY;
                if (!glmApiKey) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'GLM OCR API Key not found' }));
                    return;
                }

                const ocrStartTime = Date.now();
                const dataUri = `data:${mimeType};base64,${base64Data}`;
                let glmResponse;
                try {
                    glmResponse = await fetch(GLM_OCR_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${glmApiKey}`
                        },
                        body: JSON.stringify({
                            model: 'glm-ocr',
                            file: dataUri
                        })
                    });
                } catch (error) {
                    res.statusCode = 502;
                    res.end(JSON.stringify({ error: `GLM OCR fetch failed: ${formatErrorMessage(error)}` }));
                    return;
                }

                if (!glmResponse.ok) {
                    const errorText = await glmResponse.text();
                    res.statusCode = glmResponse.status;
                    res.end(JSON.stringify({ error: `GLM OCR Failed: ${errorText}` }));
                    return;
                }

                const glmResult = await glmResponse.json();
                const ocrDuration = Date.now() - ocrStartTime;
                const ocrText = glmResult.md_results || '';
                const schemaText = JSON.stringify(invoiceSchema || {}, null, 2);
                const parsePrompt = `以下是中国医疗发票的 OCR 识别结果（Markdown 格式）。请从中提取结构化信息。

## 重要规则
1. 只提取 OCR 文本中**明确存在**的信息，严禁补充或编造
2. 费用明细项目**不要重复**，同一项目只提取一次
3. 注意区分"个人自付"（personalSelfPayment，医保目录内）和"个人自费"（personalSelfExpense，医保目录外）
4. 医院名称优先从票面印刷文字提取，印章文字仅作参考且不要优先采用
5. 忽略 OCR 排版干扰，专注于内容
6. 只返回 JSON，不要使用代码块或多余文字

## OCR 原文
${ocrText}

## 输出 JSON 格式
${schemaText}

## 输出规范
- 日期格式：YYYY-MM-DD
- 数字字段：纯数字，不含货币符号或千分位逗号
- 无法识别的字段：字符串用 ""，数字用 0`;

                if (mode === 'glm-ocr-structured') {
                    const parsingStartTime = Date.now();
                    const glmTextModel = process.env.GLM_TEXT_MODEL || process.env.ZHIPU_MODEL || 'glm-4.7-flash';
                    const glmParseResponse = await callGlmChat({
                        apiKey: glmApiKey,
                        model: glmTextModel,
                        messages: [{ role: 'user', content: parsePrompt }],
                        temperature: 0
                    });
                    const parsingDuration = Date.now() - parsingStartTime;
                    const glmContent = glmParseResponse?.choices?.[0]?.message?.content || '';
                    const extracted = extractJsonFromText(glmContent);

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        text: extracted || '{}',
                        usageMetadata: {
                            ocr: glmResult.usage,
                            parsing: glmParseResponse.usage
                        },
                        timing: {
                            ocrDuration,
                            parsingDuration,
                            totalDuration: ocrDuration + parsingDuration
                        }
                    }));
                    return;
                }

                const parsingStartTime = Date.now();
                const parseResponse = await callGemini({
                    model: geminiModel || 'gemini-2.5-flash',
                    contents: {
                        parts: [{ text: parsePrompt }]
                    },
                    temperature: 0
                });
                const parsingDuration = Date.now() - parsingStartTime;

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    text: parseResponse.text || '{}',
                    usageMetadata: {
                        ocr: glmResult.usage,
                        parsing: parseResponse.usageMetadata
                    },
                    timing: {
                        ocrDuration,
                        parsingDuration,
                        totalDuration: ocrDuration + parsingDuration
                    }
                }));
                return;
            }

            const response = await callGemini({
                model: geminiModel || 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType, data: base64Data } },
                        { text: prompt || '' }
                    ]
                },
                temperature: 0.1
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                text: response.text || '{}',
                usageMetadata: response.usageMetadata
            }));
        } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: formatErrorMessage(error) }));
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

            // 特殊处理：批量日志插入
            if (resource === 'user-operation-logs' && newItem.logs && Array.isArray(newItem.logs)) {
                data.push(...newItem.logs);
                writeData(resource, data);
                res.statusCode = 201;
                res.end(JSON.stringify({ success: true, count: newItem.logs.length }));
            } else {
                // 原有逻辑：单个插入
                data.push(newItem);
                writeData(resource, data);
                res.statusCode = 201;
                res.end(JSON.stringify({ success: true, data: newItem }));
            }
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
