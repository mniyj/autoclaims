import { diseaseDrugRelDao, diseaseServiceRelDao, surgeryComboDao, policyCoverageRelDao } from '../dao/index.js';
import { diseaseDao, drugDao, serviceItemDao, hospitalDao } from '../dao/index.js';

export function getDiseaseGraph(diseaseId) {
  const disease = diseaseDao.getDiseaseById(diseaseId);
  if (!disease) {
    return { error: 'Disease not found' };
  }

  const drugRels = diseaseDrugRelDao.getDiseaseDrugRelsByDisease(diseaseId);
  const serviceRels = diseaseServiceRelDao.getDiseaseServiceRelsByDisease(diseaseId);

  const drugs = drugRels.map(rel => {
    const drug = drugDao.getDrugById(rel.drug_id);
    return {
      id: rel.drug_id,
      name: drug?.generic_name || rel.drug_id,
      relType: rel.rel_type,
      evidenceLevel: rel.evidence_level
    };
  });

  const services = serviceRels.map(rel => {
    const item = serviceItemDao.getServiceItemById(rel.item_id);
    return {
      id: rel.item_id,
      name: item?.standard_name || rel.item_id,
      relType: rel.rel_type,
      evidenceLevel: rel.evidence_level
    };
  });

  return {
    disease: {
      id: disease.disease_id,
      name: disease.standard_name,
      icdCode: disease.icd_code,
      severityLevel: disease.severity_level,
      inpatientNecessity: disease.inpatient_necessity_flag
    },
    drugs,
    services,
    drugCount: drugs.length,
    serviceCount: services.length
  };
}

export function getDrugGraph(drugId) {
  const drug = drugDao.getDrugById(drugId);
  if (!drug) {
    return { error: 'Drug not found' };
  }

  const rels = diseaseDrugRelDao.getDiseaseDrugRelsByDrug(drugId);

  const diseases = rels.map(rel => {
    const disease = diseaseDao.getDiseaseById(rel.disease_id);
    return {
      id: rel.disease_id,
      name: disease?.standard_name || rel.disease_id,
      icdCode: disease?.icd_code,
      relType: rel.rel_type,
      evidenceLevel: rel.evidence_level
    };
  });

  return {
    drug: {
      id: drug.drug_id,
      genericName: drug.generic_name,
      brandName: drug.brand_name,
      dosageForm: drug.dosage_form,
      spec: drug.spec
    },
    diseases,
    diseaseCount: diseases.length
  };
}

export function getServiceItemGraph(itemId) {
  const item = serviceItemDao.getServiceItemById(itemId);
  if (!item) {
    return { error: 'Service item not found' };
  }

  const diseaseRels = diseaseServiceRelDao.getDiseaseServiceRelsByItem(itemId);
  const surgeryCombos = surgeryComboDao.getSurgeryCombosBySurgery(itemId);

  const diseases = diseaseRels.map(rel => {
    const disease = diseaseDao.getDiseaseById(rel.disease_id);
    return {
      id: rel.disease_id,
      name: disease?.standard_name || rel.disease_id,
      relType: rel.rel_type,
      evidenceLevel: rel.evidence_level
    };
  });

  const relatedSurgeries = surgeryCombos.map(combo => {
    const surgery = serviceItemDao.getServiceItemById(combo.surgery_item_id);
    return {
      id: combo.surgery_item_id,
      name: surgery?.standard_name || combo.surgery_item_id,
      comboType: combo.combo_type,
      required: combo.required_flag,
      confidence: combo.confidence
    };
  });

  return {
    service: {
      id: item.item_id,
      name: item.standard_name,
      category: item.item_category,
      subCategory: item.sub_category
    },
    diseases,
    relatedSurgeries,
    diseaseCount: diseases.length,
    surgeryCount: relatedSurgeries.length
  };
}

export function searchGraph(query, entityType = null) {
  const results = {
    diseases: [],
    drugs: [],
    services: []
  };

  if (!entityType || entityType === 'disease') {
    const diseases = diseaseDao.search(query);
    results.diseases = diseases.slice(0, 10).map(d => ({
      id: d.disease_id,
      name: d.standard_name,
      icdCode: d.icd_code
    }));
  }

  if (!entityType || entityType === 'drug') {
    const drugs = drugDao.search(query);
    results.drugs = drugs.slice(0, 10).map(d => ({
      id: d.drug_id,
      name: d.generic_name,
      brandName: d.brand_name
    }));
  }

  if (!entityType || entityType === 'service_item') {
    const services = serviceItemDao.search(query);
    results.services = services.slice(0, 10).map(s => ({
      id: s.item_id,
      name: s.standard_name,
      category: s.item_category
    }));
  }

  return results;
}

export function getProductCoverageGraph(productId) {
  const rels = policyCoverageRelDao.getPolicyCoverageRelsByProduct(productId);

  const coverage = {
    drugs: [],
    services: [],
    exclusions: []
  };

  for (const rel of rels) {
    if (rel.coverage_action === 'cover') {
      if (rel.entity_type === 'drug') {
        const drug = drugDao.getDrugById(rel.entity_id);
        coverage.drugs.push({
          id: rel.entity_id,
          name: drug?.generic_name || rel.entity_id
        });
      } else if (rel.entity_type === 'service_item') {
        const item = serviceItemDao.getServiceItemById(rel.entity_id);
        coverage.services.push({
          id: rel.entity_id,
          name: item?.standard_name || rel.entity_id
        });
      }
    } else if (rel.coverage_action === 'exclude') {
      coverage.exclusions.push({
        id: rel.entity_id,
        entityType: rel.entity_type,
        coverageType: rel.coverage_type
      });
    }
  }

  return coverage;
}

export default {
  getDiseaseGraph,
  getDrugGraph,
  getServiceItemGraph,
  searchGraph,
  getProductCoverageGraph
};
