/**
 * Migration script to add ossKey field to existing claim materials
 * Extracts the object key from existing OSS signed URLs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MATERIALS_FILE = path.join(__dirname, '../../jsonlist/claims-materials.json');

function extractOssKeyFromUrl(url) {
  if (!url) return null;
  
  try {
    // Parse the URL to extract the object key
    // Format: http://bucket.oss-region.aliyuncs.com/path/to/file.jpg?params
    const urlObj = new URL(url);
    // Get the pathname without leading slash
    const ossKey = urlObj.pathname.substring(1);
    return ossKey || null;
  } catch (error) {
    console.error('Failed to parse URL:', url, error);
    return null;
  }
}

function migrateMaterials() {
  console.log('Starting migration: add ossKey to claim materials...');
  
  // Read the materials file
  const materialsData = fs.readFileSync(MATERIALS_FILE, 'utf8');
  const materials = JSON.parse(materialsData);
  
  let updatedCount = 0;
  
  // Process each material
  const updatedMaterials = materials.map(material => {
    // Skip if already has ossKey
    if (material.ossKey) {
      return material;
    }
    
    // Extract ossKey from sampleUrl if available
    if (material.sampleUrl) {
      const ossKey = extractOssKeyFromUrl(material.sampleUrl);
      if (ossKey) {
        updatedCount++;
        return {
          ...material,
          ossKey
        };
      }
    }
    
    return material;
  });
  
  // Write back to file
  fs.writeFileSync(
    MATERIALS_FILE,
    JSON.stringify(updatedMaterials, null, 2),
    'utf8'
  );
  
  console.log(`Migration complete! Updated ${updatedCount} materials with ossKey.`);
  console.log(`Total materials: ${materials.length}`);
}

// Run migration
migrateMaterials();

export { migrateMaterials, extractOssKeyFromUrl };
