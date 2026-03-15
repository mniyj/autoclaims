import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../jsonlist/knowledge');

function ensureDataDir() {
  const dir = path.join(DATA_DIR, 'processed');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFilePath(collection) {
  return path.join(ensureDataDir(), `${collection}.json`);
}

function readCollection(collection) {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeCollection(collection, data) {
  const filePath = getFilePath(collection);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export const NodeType = {
  CONTRACT: 'contract',
  DIAGNOSIS: 'diagnosis',
  DRUG: 'drug',
  SERVICE: 'service',
  AMOUNT: 'amount',
  RULE: 'rule',
  MODEL: 'model',
  CONCLUSION: 'conclusion'
};

export const EdgeType = {
  SUPPORTS: 'supports',
  CONTRADICTS: 'contradicts',
  TRIGGERS: 'triggers',
  DERIVED_FROM: 'derived_from',
  EXCEEDS_THRESHOLD: 'exceeds_threshold',
  MATCHES_POLICY: 'matches_policy'
};

let nodeIdCounter = 1;
let edgeIdCounter = 1;

function generateNodeId() {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

function generateEdgeId() {
  return `edge_${Date.now()}_${edgeIdCounter++}`;
}

export function createEvidenceGraph(caseId) {
  return {
    case_id: caseId,
    nodes: [],
    edges: [],
    conclusion: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function addNode(graph, nodeType, label, data = {}) {
  const node = {
    node_id: generateNodeId(),
    node_type: nodeType,
    label,
    data,
    created_at: new Date().toISOString()
  };
  graph.nodes.push(node);
  graph.updated_at = new Date().toISOString();
  return node;
}

export function addEdge(graph, sourceNodeId, targetNodeId, edgeType, weight = 1) {
  const edge = {
    edge_id: generateEdgeId(),
    source_node_id: sourceNodeId,
    target_node_id: targetNodeId,
    edge_type: edgeType,
    weight,
    created_at: new Date().toISOString()
  };
  graph.edges.push(edge);
  graph.updated_at = new Date().toISOString();
  return edge;
}

export function setConclusion(graph, decision, reason, riskScore = null) {
  graph.conclusion = {
    decision,
    reason,
    risk_score: riskScore,
    created_at: new Date().toISOString()
  };
  graph.updated_at = new Date().toISOString();
  return graph.conclusion;
}

export function buildClaimEvidenceGraph(claimData, assessmentResult) {
  const graph = createEvidenceGraph(claimData.claim_case_id || claimData.caseId);

  const contractNode = addNode(graph, NodeType.CONTRACT, '保单合同', {
    policyNumber: claimData.policyNumber,
    productCode: claimData.productCode,
    coverage: claimData.coverage
  });

  if (claimData.diagnosis) {
    const diagnosisNode = addNode(graph, NodeType.DIAGNOSIS, claimData.diagnosis.name || claimData.diagnosis, {
      code: claimData.diagnosis.code,
      name: claimData.diagnosis.name
    });
    addEdge(graph, diagnosisNode.node_id, contractNode.node_id, EdgeType.MATCHES_POLICY);
  }

  if (claimData.drugs && claimData.drugs.length > 0) {
    for (const drug of claimData.drugs) {
      const drugNode = addNode(graph, NodeType.DRUG, drug.name || drug.drugId, {
        drugId: drug.drugId,
        amount: drug.amount
      });

      if (drug.matchResult) {
        const ruleNode = addNode(graph, NodeType.RULE, '诊断-药品匹配', {
          result: drug.matchResult.matched ? '匹配' : '不匹配',
          action: drug.matchResult.action
        });
        addEdge(graph, drugNode.node_id, ruleNode.node_id, drug.matchResult.matched ? EdgeType.SUPPORTS : EdgeType.CONTRADICTS);
      }
    }
  }

  if (claimData.services && claimData.services.length > 0) {
    for (const service of claimData.services) {
      const serviceNode = addNode(graph, NodeType.SERVICE, service.name || service.itemId, {
        itemId: service.itemId,
        amount: service.amount
      });

      if (service.matchResult) {
        const ruleNode = addNode(graph, NodeType.RULE, '诊断-项目匹配', {
          result: service.matchResult.matched ? '匹配' : '不匹配',
          action: service.matchResult.action
        });
        addEdge(graph, serviceNode.node_id, ruleNode.node_id, service.matchResult.matched ? EdgeType.SUPPORTS : EdgeType.CONTRADICTS);
      }
    }
  }

  if (claimData.hospitalDays) {
    const hospNode = addNode(graph, NodeType.SERVICE, `住院${claimData.hospitalDays}天`, {
      days: claimData.hospitalDays
    });

    if (assessmentResult?.hospitalization) {
      const ruleNode = addNode(graph, NodeType.RULE, '住院必要性', {
        necessary: assessmentResult.hospitalization.necessary,
        reason: assessmentResult.hospitalization.reason
      });
      addEdge(graph, hospNode.node_id, ruleNode.node_id, 
        assessmentResult.hospitalization.necessary !== false ? EdgeType.SUPPORTS : EdgeType.CONTRADICTS);
    }
  }

  if (assessmentResult) {
    if (assessmentResult.warnings && assessmentResult.warnings.length > 0) {
      for (const warning of assessmentResult.warnings) {
        const ruleNode = addNode(graph, NodeType.RULE, warning.reason || '审核警告', {
          type: warning.type,
          target: warning.target
        });
        addEdge(graph, ruleNode.node_id, contractNode.node_id, EdgeType.TRIGGERS);
      }
    }

    if (assessmentResult.needsManualReview) {
      const modelNode = addNode(graph, NodeType.MODEL, '风险评估', {
        needsReview: true,
        warnings: assessmentResult.warnings?.length || 0
      });
      addEdge(graph, modelNode.node_id, contractNode.node_id, EdgeType.TRIGGERS);
    }
  }

  const amount = assessmentResult?.finalAmount || claimData.claimAmount || 0;
  const amountNode = addNode(graph, NodeType.AMOUNT, `¥${amount}`, {
    claimedAmount: claimData.claimAmount,
    approvedAmount: amount,
    deductible: assessmentResult?.deductible,
    reimbursementRatio: assessmentResult?.reimbursementRatio
  });

  const decision = assessmentResult?.needsManualReview ? 'MANUAL_REVIEW' : 
                  (amount > 0 ? 'APPROVE' : 'REJECT');
  const reason = assessmentResult?.needsManualReview ? '需要人工审核' :
                (amount > 0 ? '审核通过' : '审核拒绝');

  setConclusion(graph, decision, reason, assessmentResult?.riskScore);

  return graph;
}

export function saveEvidenceGraph(graph) {
  const graphs = readCollection('evidence_graphs');
  const index = graphs.findIndex(g => g.case_id === graph.case_id);
  if (index >= 0) {
    graphs[index] = { ...graph, updated_at: new Date().toISOString() };
  } else {
    graphs.push(graph);
  }
  writeCollection('evidence_graphs', graphs);
  return graph;
}

export function getEvidenceGraph(caseId) {
  const graphs = readCollection('evidence_graphs');
  return graphs.find(g => g.case_id === caseId) || null;
}

export function toVisualizationFormat(graph) {
  if (!graph) return null;

  const nodes = graph.nodes.map(node => ({
    id: node.node_id,
    label: node.label,
    type: node.node_type,
    data: node.data
  }));

  const edges = graph.edges.map(edge => ({
    id: edge.edge_id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    type: edge.edge_type,
    weight: edge.weight
  }));

  return {
    nodes,
    edges,
    conclusion: graph.conclusion,
    caseId: graph.case_id,
    createdAt: graph.created_at
  };
}

export default {
  NodeType,
  EdgeType,
  createEvidenceGraph,
  addNode,
  addEdge,
  setConclusion,
  buildClaimEvidenceGraph,
  saveEvidenceGraph,
  getEvidenceGraph,
  toVisualizationFormat
};
