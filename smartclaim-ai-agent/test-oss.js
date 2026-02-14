
import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple env parser
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

console.log("Configured Region:", config.region);
console.log("Configured Bucket:", config.bucket);
console.log("AccessKeyID present:", !!config.accessKeyId);

if (!config.accessKeyId || !config.accessKeySecret) {
    console.error("Missing credentials in .env.local");
    process.exit(1);
}

const client = new OSS(config);

async function testConnection() {
    try {
        console.log("Testing connection to OSS...");
        const result = await client.list({ 'max-keys': 1 });
        console.log("Connection Successful!");
        console.log("Listed file:", result.objects ? result.objects[0]?.name : "Bucket is empty");

        // Try simple upload
        const testContent = Buffer.from("OSS Connectivity Test");
        const filename = `test-connectivity-${Date.now()}.txt`;
        console.log(`Attempting to upload test file: ${filename}`);
        const putResult = await client.put(filename, testContent);
        console.log("Upload Successful:", putResult.url);

        // Clean up
        console.log("Deleting test file...");
        await client.delete(filename);
        console.log("Delete Successful");

    } catch (e) {
        console.error("OSS Connection Failed:", e);
    }
}

testConnection();
