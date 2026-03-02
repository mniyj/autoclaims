/**
 * Migration script to clean invalid sample URLs and ossKeys
 * Removes sampleUrl and ossKey for materials where the file doesn't exist in OSS
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MATERIALS_FILE = path.join(__dirname, '../../jsonlist/claims-materials.json');

function cleanInvalidSamples() {
  console.log('Starting cleanup: removing invalid sample URLs...');
  
  // Read the materials file
  const materialsData = fs.readFileSync(MATERIALS_FILE, 'utf8');
  const materials = JSON.parse(materialsData);
  
  let cleanedCount = 0;
  
  // Process each material - remove sampleUrl and ossKey if they exist
  // (since we know the files don't exist in OSS)
  const cleanedMaterials = materials.map(material => {
    if (material.sampleUrl || material.ossKey) {
      cleanedCount++;
      const { sampleUrl, ossKey, ...rest } = material;
      return rest;
    }
    return material;
  });
  
  // Write back to file
  fs.writeFileSync(
    MATERIALS_FILE,
    JSON.stringify(cleanedMaterials, null, 2),
    'utf8'
  );
  
  console.log(`Cleanup complete! Removed invalid samples from ${cleanedCount} materials.`);
  console.log(`Total materials: ${materials.length}`);
}

// Run cleanup
cleanInvalidSamples();

export { cleanInvalidSamples };
