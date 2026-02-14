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

const client = new OSS(config);

async function listFiles() {
    try {
        console.log("Listing files in bucket:", config.bucket);
        const result = await client.list({
            prefix: '',
            'max-keys': 100
        });

        if (result.objects && result.objects.length > 0) {
            console.log("Files found:");
            result.objects.forEach(obj => {
                console.log(`- ${obj.name} (${obj.size} bytes)`);
            });
        } else {
            console.log("No files found in bucket.");
        }

        // Check specifically for claims/ prefix
        console.log("\nChecking for 'claims/' prefix:");
        const claimsResult = await client.list({
            prefix: 'claims/',
            'max-keys': 10
        });
        if (claimsResult.objects && claimsResult.objects.length > 0) {
            console.log("'claims/' folder exists and has files.");
        } else {
            console.log("'claims/' folder not found or empty.");
        }

    } catch (e) {
        console.error("Failed to list files:", e);
    }
}

listFiles();
