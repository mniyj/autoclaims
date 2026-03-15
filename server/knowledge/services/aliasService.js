import { aliasDao } from '../dao/index.js';
import { drugDao } from '../dao/index.js';
import { diseaseDao } from '../dao/index.js';
import { serviceItemDao } from '../dao/index.js';
import { hospitalDao } from '../dao/index.js';

const ENTITY_TYPE_MAP = {
  'drug': { dao: drugDao, idField: 'drug_id', nameField: 'generic_name' },
  'service_item': { dao: serviceItemDao, idField: 'item_id', nameField: 'standard_name' },
  'disease': { dao: diseaseDao, idField: 'disease_id', nameField: 'standard_name' },
  'hospital': { dao: hospitalDao, idField: 'hospital_id', nameField: 'standard_name' }
};

export function normalizeName(rawName, entityType = null) {
  if (!rawName || typeof rawName !== 'string') {
    return { error: 'Invalid input' };
  }

  const trimmedName = rawName.trim().toLowerCase();
  
  if (entityType) {
    return normalizeToEntityType(trimmedName, entityType);
  }
  
  return normalizeAutoDetect(trimmedName);
}

function normalizeToEntityType(name, entityType) {
  const config = ENTITY_TYPE_MAP[entityType];
  if (!config) {
    return { error: `Unknown entity type: ${entityType}` };
  }

  const aliases = aliasDao.findAliasByText(name, entityType);
  if (aliases.length > 0) {
    const bestMatch = aliases.sort((a, b) => b.confidence - a.confidence)[0];
    return {
      entityId: bestMatch.entity_id,
      entityType,
      confidence: bestMatch.confidence,
      normalized: bestMatch.alias_text,
      source: 'alias_mapping'
    };
  }

  const results = config.dao.search(name);
  if (results.length > 0) {
    return {
      entityId: results[0][config.idField],
      entityType,
      confidence: 0.6,
      normalized: results[0][config.nameField],
      source: 'fuzzy_search'
    };
  }

  return {
    entityId: null,
    entityType,
    confidence: 0,
    normalized: name,
    source: 'not_found'
  };
}

function normalizeAutoDetect(name) {
  const entityTypes = Object.keys(ENTITY_TYPE_MAP);
  const candidates = [];

  for (const entityType of entityTypes) {
    const aliases = aliasDao.findAliasByText(name, entityType);
    if (aliases.length > 0) {
      for (const alias of aliases) {
        candidates.push({
          entityId: alias.entity_id,
          entityType,
          confidence: alias.confidence,
          normalized: alias.alias_text,
          source: 'alias_mapping'
        });
      }
    }

    const config = ENTITY_TYPE_MAP[entityType];
    const results = config.dao.search(name);
    if (results.length > 0) {
      candidates.push({
        entityId: results[0][config.idField],
        entityType,
        confidence: 0.5,
        normalized: results[0][config.nameField],
        source: 'fuzzy_search'
      });
    }
  }

  if (candidates.length === 0) {
    return {
      entityId: null,
      entityType: null,
      confidence: 0,
      normalized: name,
      source: 'not_found'
    };
  }

  return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}

export function normalizeBatch(items) {
  return items.map(item => ({
    original: item.name || item.rawName,
    ...normalizeName(item.name || item.rawName, item.entityType)
  }));
}

export function addAliasMapping(aliasText, entityType, entityId, confidence = 0.9, source = 'manual') {
  const config = ENTITY_TYPE_MAP[entityType];
  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const entity = config.dao.getById ? config.dao.getById(entityId) : null;
  const entityName = entity ? entity[config.nameField] : null;

  const alias = {
    alias_id: `ALIAS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    alias_text: aliasText.trim().toLowerCase(),
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    source,
    confidence,
    status: 'active'
  };

  return aliasDao.saveAlias(alias);
}

export function removeAliasMapping(aliasId) {
  return aliasDao.deleteAlias(aliasId);
}

export function searchAliasMappings(query, entityType = null) {
  return aliasDao.searchAliases(query, entityType);
}

export function getAliasesForEntity(entityType, entityId) {
  return aliasDao.findAliasesByEntity(entityType, entityId);
}

export default {
  normalizeName,
  normalizeBatch,
  addAliasMapping,
  removeAliasMapping,
  searchAliasMappings,
  getAliasesForEntity
};
