import * as drugDao from './dao/drugDao.js';
import * as serviceItemDao from './dao/serviceItemDao.js';
import * as diseaseDao from './dao/diseaseDao.js';
import * as hospitalDao from './dao/hospitalDao.js';
import * as policyRuleDao from './dao/policyRuleDao.js';
import * as aliasDao from './dao/aliasDao.js';
import * as diseaseDrugRuleDao from './dao/diseaseDrugRuleDao.js';
import * as diseaseServiceRuleDao from './dao/diseaseServiceRuleDao.js';
import * as dosageRuleDao from './dao/dosageRuleDao.js';
import * as frequencyRuleDao from './dao/frequencyRuleDao.js';
import * as hospitalizationRuleDao from './dao/hospitalizationRuleDao.js';
import * as diseaseDrugRelDao from './dao/diseaseDrugRelDao.js';
import * as diseaseServiceRelDao from './dao/diseaseServiceRelDao.js';
import * as surgeryComboDao from './dao/surgeryComboDao.js';
import * as policyCoverageRelDao from './dao/policyCoverageRelDao.js';

import aliasService from './services/aliasService.js';
import medicalAssessmentService from './services/medicalAssessmentService.js';
import graphService from './services/graphService.js';
import evidenceGraphService from './services/evidenceGraphService.js';

export const knowledgeService = {
  searchEntities(query, entityType) {
    return graphService.searchGraph(query, entityType);
  },

  normalizeName(rawName, entityType) {
    return aliasService.normalizeName(rawName, entityType);
  },

  normalizeBatch(items) {
    return aliasService.normalizeBatch(items);
  },

  addAliasMapping(aliasText, entityType, entityId, confidence, source) {
    return aliasService.addAliasMapping(aliasText, entityType, entityId, confidence, source);
  },

  searchAliasMappings(query, entityType) {
    return aliasService.searchAliasMappings(query, entityType);
  },

  assessMedicalReasonability(assessment) {
    return medicalAssessmentService.assessMedicalReasonability(assessment);
  },

  getRecommendedDrugs(diseaseId) {
    return medicalAssessmentService.getRecommendedDrugs(diseaseId);
  },

  getRecommendedServices(diseaseId) {
    return medicalAssessmentService.getRecommendedServices(diseaseId);
  },

  getSurgeryCombo(surgeryItemId) {
    return medicalAssessmentService.getSurgeryCombo(surgeryItemId);
  },

  getDiseaseGraph(diseaseId) {
    return graphService.getDiseaseGraph(diseaseId);
  },

  getDrugGraph(drugId) {
    return graphService.getDrugGraph(drugId);
  },

  getServiceItemGraph(itemId) {
    return graphService.getServiceItemGraph(itemId);
  },

  getProductCoverageGraph(productId) {
    return graphService.getProductCoverageGraph(productId);
  },

  buildClaimEvidenceGraph(claimData, assessmentResult) {
    return evidenceGraphService.buildClaimEvidenceGraph(claimData, assessmentResult);
  },

  saveEvidenceGraph(graph) {
    return evidenceGraphService.saveEvidenceGraph(graph);
  },

  getEvidenceGraph(caseId) {
    return evidenceGraphService.getEvidenceGraph(caseId);
  },

  toVisualizationFormat(graph) {
    return evidenceGraphService.toVisualizationFormat(graph);
  }
};

export default knowledgeService;
