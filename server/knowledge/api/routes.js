import { Router } from 'express';
import { knowledgeService } from '../service.js';
import * as drugDao from '../dao/drugDao.js';
import * as serviceItemDao from '../dao/serviceItemDao.js';
import * as diseaseDao from '../dao/diseaseDao.js';
import * as hospitalDao from '../dao/hospitalDao.js';

const router = Router();

router.get('/entity/search', async (req, res) => {
  try {
    const { q, type } = req.query;
    const results = knowledgeService.searchEntities(q, type);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alias/normalize', async (req, res) => {
  try {
    const { rawName, entityType } = req.body;
    const result = knowledgeService.normalizeName(rawName, entityType);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alias/batch-normalize', async (req, res) => {
  try {
    const { items } = req.body;
    const results = knowledgeService.normalizeBatch(items);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alias/mapping', async (req, res) => {
  try {
    const { aliasText, entityType, entityId, confidence, source } = req.body;
    const result = knowledgeService.addAliasMapping(aliasText, entityType, entityId, confidence, source);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alias/mappings', async (req, res) => {
  try {
    const { query, entityType } = req.query;
    const results = knowledgeService.searchAliasMappings(query, entityType);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/graph/disease/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const graph = knowledgeService.getDiseaseGraph(id);
    res.json({ success: true, data: graph });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/graph/drug/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const graph = knowledgeService.getDrugGraph(id);
    res.json({ success: true, data: graph });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/graph/service/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const graph = knowledgeService.getServiceItemGraph(id);
    res.json({ success: true, data: graph });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/graph/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const graph = knowledgeService.getProductCoverageGraph(id);
    res.json({ success: true, data: graph });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/assess/reasonability', async (req, res) => {
  try {
    const assessment = req.body;
    const result = knowledgeService.assessMedicalReasonability(assessment);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recommendations/drugs/:diseaseId', async (req, res) => {
  try {
    const { diseaseId } = req.params;
    const drugs = knowledgeService.getRecommendedDrugs(diseaseId);
    res.json({ success: true, data: drugs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recommendations/services/:diseaseId', async (req, res) => {
  try {
    const { diseaseId } = req.params;
    const services = knowledgeService.getRecommendedServices(diseaseId);
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recommendations/surgery-combo/:surgeryId', async (req, res) => {
  try {
    const { surgeryId } = req.params;
    const combo = knowledgeService.getSurgeryCombo(surgeryId);
    res.json({ success: true, data: combo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/evidence-graph', async (req, res) => {
  try {
    const { claimData, assessmentResult } = req.body;
    const graph = knowledgeService.buildClaimEvidenceGraph(claimData, assessmentResult);
    knowledgeService.saveEvidenceGraph(graph);
    res.json({ success: true, data: knowledgeService.toVisualizationFormat(graph) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/evidence-graph/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const graph = knowledgeService.getEvidenceGraph(caseId);
    if (!graph) {
      return res.status(404).json({ success: false, error: 'Graph not found' });
    }
    res.json({ success: true, data: knowledgeService.toVisualizationFormat(graph) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Drug CRUD =====
router.get('/drugs', async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    let drugs = drugDao.getAllDrugs();
    if (q) {
      drugs = drugDao.search(q);
    }
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    res.json({
      success: true,
      data: drugs.slice(start, end),
      meta: { total: drugs.length, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/drugs/:id', async (req, res) => {
  try {
    const drug = drugDao.getDrugById(req.params.id);
    if (!drug) return res.status(404).json({ success: false, error: 'Drug not found' });
    res.json({ success: true, data: drug });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/drugs', async (req, res) => {
  try {
    const drug = drugDao.saveDrug(req.body);
    res.json({ success: true, data: drug });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/drugs/:id', async (req, res) => {
  try {
    const drug = drugDao.saveDrug({ ...req.body, drug_id: req.params.id });
    res.json({ success: true, data: drug });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/drugs/:id', async (req, res) => {
  try {
    drugDao.deleteDrug(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Service Item CRUD =====
router.get('/service-items', async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    let items = serviceItemDao.getAllServiceItems();
    if (q) {
      items = serviceItemDao.search(q);
    }
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    res.json({
      success: true,
      data: items.slice(start, end),
      meta: { total: items.length, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/service-items/:id', async (req, res) => {
  try {
    const item = serviceItemDao.getServiceItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Service item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/service-items', async (req, res) => {
  try {
    const item = serviceItemDao.saveServiceItem(req.body);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/service-items/:id', async (req, res) => {
  try {
    const item = serviceItemDao.saveServiceItem({ ...req.body, item_id: req.params.id });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/service-items/:id', async (req, res) => {
  try {
    serviceItemDao.deleteServiceItem(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Disease CRUD =====
router.get('/diseases', async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    let diseases = diseaseDao.getAllDiseases();
    if (q) {
      diseases = diseaseDao.search(q);
    }
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    res.json({
      success: true,
      data: diseases.slice(start, end),
      meta: { total: diseases.length, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/diseases/:id', async (req, res) => {
  try {
    const disease = diseaseDao.getDiseaseById(req.params.id);
    if (!disease) return res.status(404).json({ success: false, error: 'Disease not found' });
    res.json({ success: true, data: disease });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/diseases', async (req, res) => {
  try {
    const disease = diseaseDao.saveDisease(req.body);
    res.json({ success: true, data: disease });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/diseases/:id', async (req, res) => {
  try {
    const disease = diseaseDao.saveDisease({ ...req.body, disease_id: req.params.id });
    res.json({ success: true, data: disease });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/diseases/:id', async (req, res) => {
  try {
    diseaseDao.deleteDisease(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Hospital CRUD =====
router.get('/hospitals', async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    let hospitals = hospitalDao.getAllHospitals();
    if (q) {
      hospitals = hospitalDao.search(q);
    }
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    res.json({
      success: true,
      data: hospitals.slice(start, end),
      meta: { total: hospitals.length, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/hospitals/:id', async (req, res) => {
  try {
    const hospital = hospitalDao.getHospitalById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, error: 'Hospital not found' });
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/hospitals', async (req, res) => {
  try {
    const hospital = hospitalDao.saveHospital(req.body);
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/hospitals/:id', async (req, res) => {
  try {
    const hospital = hospitalDao.saveHospital({ ...req.body, hospital_id: req.params.id });
    res.json({ success: true, data: hospital });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/hospitals/:id', async (req, res) => {
  try {
    hospitalDao.deleteHospital(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
