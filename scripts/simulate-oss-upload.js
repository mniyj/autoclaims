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

async function simulateUpload() {
    try {
        const filename = `claims/simulator-test-${Date.now()}.txt`;
        console.log("Simulating upload to:", filename);
        const result = await client.put(filename, Buffer.from("Simulation Content"));
        console.log("Upload result URL:", result.url);

        // Wait a bit and check if it exists
        await new Promise(r => setTimeout(r, 2000));
        const headResult = await client.get(filename);
        console.log("Successfully verified file existence in OSS!");

        // NO DELETE THIS TIME so the user can see it in console
        console.log("FILE LEFT IN OSS FOR YOUR VERIFICATION: ", filename);

    } catch (e) {
        console.error("Simulation failed:", e);
    }
}

simulateUpload();
