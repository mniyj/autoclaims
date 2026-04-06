import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnv = () => {
    try {
        const envPath = path.join(__dirname, '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const env = {};
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    env[key] = value;
                }
            });
            return env;
        }
    } catch (e) {
        console.error("Error reading .env.local", e);
    }
    return {};
};

const env = loadEnv();

const config = {
    region: env.ALIYUN_OSS_REGION,
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    bucket: env.ALIYUN_OSS_BUCKET
};

console.log("Testing ROOT OSS Configuration:");
console.log("Region:", config.region);
console.log("Bucket:", config.bucket);
console.log("Keys Loaded:", !!config.accessKeyId && !!config.accessKeySecret);

if (!config.accessKeyId || !config.accessKeySecret) {
    console.error("Missing credentials in root .env.local");
    process.exit(1);
}

const client = new OSS(config);

async function test() {
    try {
        const result = await client.list({ 'max-keys': 1 });
        console.log("SUCCESS: Connected to OSS from root!");
        console.log("Objects in bucket:", result.objects ? result.objects.length : 0);

        const testFile = `root-test-${Date.now()}.txt`;
        await client.put(testFile, Buffer.from("root test success"));
        console.log("SUCCESS: Uploaded test file:", testFile);

        await client.delete(testFile);
        console.log("SUCCESS: Deleted test file.");
    } catch (e) {
        console.error("FAILURE: OSS test failed from root:", e.message);
    }
}

test();
