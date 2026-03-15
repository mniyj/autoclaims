import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = path.join(__dirname, '../../../jsonlist/medical-insurance-catalog.json');
const TARGET_DIR = path.join(__dirname, '../../../jsonlist/knowledge/processed');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function mapReimbursementType(type) {
  const mapping = { 'A': '甲类', 'B': '乙类', 'C': '丙类', 'excluded': '自费' };
  return mapping[type] || '自费';
}

function parseSpec(specifications) {
  if (!specifications) return { spec: '', package: '' };
  const parts = specifications.split('×');
  if (parts.length >= 2) {
    return { spec: parts[0].trim(), package: parts[1].trim() };
  }
  return { spec: specifications, package: '' };
}

function generateId(prefix, index) {
  return `${prefix}_${String(index).padStart(6, '0')}`;
}

function migrateDrugs(catalogData) {
  console.log('Migrating drugs...');
  
  const drugs = catalogData
    .filter(item => item.category === 'drug')
    .map((item, index) => {
      const { spec, package: pkg } = parseSpec(item.specifications);
      
      return {
        drug_id: generateId('DRUG', index + 1),
        generic_name: item.genericName || item.name,
        brand_name: item.name !== item.genericName ? item.name : '',
        aliases: item.aliases || [],
        dosage_form: item.dosageForm || '',
        spec: spec,
        package: pkg,
        manufacturer: item.manufacturer || '',
        nhsa_code: item.code || '',
        nmpa_approval_no: '',
        reimbursement_flag: mapReimbursementType(item.type),
        reimbursement_restriction: item.restrictions || '',
        indications: item.indications || '',
        dose_min: null,
        dose_max: null,
        course_min: null,
        course_max: null,
        route: '',
        source: item.province || 'national',
        version: '1.0',
        valid_from: item.effectiveDate || '2024-01-01',
        valid_to: item.expiryDate || '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  
  console.log(`Migrated ${drugs.length} drugs`);
  return drugs;
}

function migrateServiceItems(catalogData) {
  console.log('Migrating service items...');
  
  const items = catalogData
    .filter(item => item.category === 'treatment' || item.category === 'material')
    .map((item, index) => {
      return {
        item_id: generateId('ITEM', index + 1),
        standard_name: item.name,
        aliases: item.aliases || [],
        local_names: [],
        item_category: item.category === 'treatment' ? '治疗费' : '材料费',
        sub_category: item.subCategory || '',
        local_item_code: item.code || '',
        price_low: item.price || null,
        price_high: item.price || null,
        unit: item.unit || '',
        applicable_conditions: '',
        frequency_min: null,
        frequency_max: null,
        course_min: null,
        course_max: null,
        department: '',
        inpatient_flag: true,
        outpatient_flag: true,
        source: item.province || 'national',
        version: '1.0',
        valid_from: item.effectiveDate || '2024-01-01',
        valid_to: item.expiryDate || '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  
  console.log(`Migrated ${items.length} service items`);
  return items;
}

function generateAliasMappings(drugs) {
  console.log('Generating alias mappings...');
  
  const aliases = [];
  let aliasIndex = 1;
  
  drugs.forEach(drug => {
    if (drug.aliases && drug.aliases.length > 0) {
      drug.aliases.forEach(aliasText => {
        aliases.push({
          alias_id: generateId('ALIAS', aliasIndex++),
          alias_text: aliasText,
          entity_type: 'drug',
          entity_id: drug.drug_id,
          entity_name: drug.generic_name,
          source: 'medical_catalog_import',
          confidence: 0.95,
          status: 'active',
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });
    }
  });
  
  console.log(`Generated ${aliases.length} alias mappings`);
  return aliases;
}

async function main() {
  try {
    console.log('=== Medical Catalog to Knowledge Base Migration ===\n');
    
    console.log(`Reading source: ${SOURCE_FILE}`);
    const catalogData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'));
    console.log(`Source data: ${catalogData.length} records\n`);
    
    const drugs = migrateDrugs(catalogData);
    fs.writeFileSync(
      path.join(TARGET_DIR, 'drugs.json'),
      JSON.stringify(drugs, null, 2),
      'utf-8'
    );
    console.log('Saved to drugs.json\n');
    
    const items = migrateServiceItems(catalogData);
    fs.writeFileSync(
      path.join(TARGET_DIR, 'service_items.json'),
      JSON.stringify(items, null, 2),
      'utf-8'
    );
    console.log('Saved to service_items.json\n');
    
    const aliases = generateAliasMappings(drugs);
    fs.writeFileSync(
      path.join(TARGET_DIR, 'aliases.json'),
      JSON.stringify(aliases, null, 2),
      'utf-8'
    );
    console.log('Saved to aliases.json\n');
    
    const report = {
      migration_date: new Date().toISOString(),
      source: 'medical-insurance-catalog.json',
      source_count: catalogData.length,
      results: {
        drugs: { count: drugs.length, file: 'drugs.json' },
        service_items: { count: items.length, file: 'service_items.json' },
        aliases: { count: aliases.length, file: 'aliases.json' }
      }
    };
    
    fs.writeFileSync(
      path.join(TARGET_DIR, 'migration_report.json'),
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    
    console.log('=== Migration Complete ===');
    console.log(`\nSummary:`);
    console.log(`- Drugs: ${drugs.length}`);
    console.log(`- Service Items: ${items.length}`);
    console.log(`- Aliases: ${aliases.length}`);
    console.log(`\nData saved to: ${TARGET_DIR}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
