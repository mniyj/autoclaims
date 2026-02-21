/**
 * 定损服务工厂 - 根据险种类型返回对应的定损服务
 * 支持多险种扩展：意外险、健康险、车险等
 */

/**
 * 定损服务注册表
 * key: 险种类型 (ACCIDENT, HEALTH, AUTO)
 * value: 动态导入函数
 */
const assessmentServices = {
  // 意外险 - 伤害定损
  ACCIDENT: () => import("./injuryAssessment.js").then((m) => m),

  // 健康险 - 疾病定损（预留，需要创建 diseaseAssessment.js）
  // 'HEALTH': () => import('./diseaseAssessment.js').then(m => m),

  // 车险 - 车辆定损（预留，需要创建 vehicleAssessment.js）
  // 'AUTO': () => import('./vehicleAssessment.js').then(m => m),
};

/**
 * 服务缓存（避免重复加载）
 */
const serviceCache = new Map();

/**
 * 获取定损服务
 * @param {string} insuranceType - 险种类型 (ACCIDENT|HEALTH|AUTO)
 * @returns {Promise<object>} 定损服务模块
 * @throws {Error} 不支持的险种类型
 */
export async function getAssessmentService(insuranceType) {
  const type = insuranceType?.toUpperCase();

  // 检查缓存
  if (serviceCache.has(type)) {
    return serviceCache.get(type);
  }

  const loader = assessmentServices[type];
  if (!loader) {
    throw new Error(
      `不支持的险种类型: ${insuranceType}，支持的类型: ${Object.keys(assessmentServices).join(", ")}`,
    );
  }

  try {
    const serviceModule = await loader();
    serviceCache.set(type, serviceModule);
    return serviceModule;
  } catch (error) {
    console.error(`加载定损服务失败: ${insuranceType}`, error);
    throw new Error(`定损服务加载失败: ${error.message}`);
  }
}

/**
 * 执行定损 - 统一入口
 * @param {object} params - 定损参数
 * @param {string} params.insuranceType - 险种类型
 * @param {object} params... - 其他定损参数（传给具体服务）
 * @returns {Promise<object>} 定损结果
 *
 * @example
 * // 意外伤害定损
 * const result = await assessDamage({
 *   insuranceType: 'ACCIDENT',
 *   diagnosisText: '左拇指指间关节离断',
 *   injuryDescription: '工伤事故导致'
 * });
 *
 * // 健康险疾病定损（预留）
 * const result = await assessDamage({
 *   insuranceType: 'HEALTH',
 *   diseaseType: '恶性肿瘤',
 *   stage: '重度'
 * });
 *
 * // 车险定损（预留）
 * const result = await assessDamage({
 *   insuranceType: 'AUTO',
 *   damageDescription: '前保险杠受损',
 *   repairEstimate: 5000
 * });
 */
export async function assessDamage(params) {
  const { insuranceType, ...rest } = params;

  if (!insuranceType) {
    throw new Error("未指定险种类型 (insuranceType)");
  }

  const service = await getAssessmentService(insuranceType);

  // 调用具体服务的 assess 方法
  if (service.assess && typeof service.assess === "function") {
    return service.assess(rest);
  }

  throw new Error(`定损服务缺少 assess 方法: ${insuranceType}`);
}

/**
 * 获取所有支持的险种类型
 * @returns {Array<{code: string, description: string}>} 险种列表
 */
export function getSupportedInsuranceTypes() {
  return [
    { code: "ACCIDENT", description: "意外险", available: true },
    { code: "HEALTH", description: "健康险", available: false },
    { code: "AUTO", description: "车险", available: false },
  ];
}

/**
 * 清空服务缓存（用于热重载）
 */
export function clearServiceCache() {
  serviceCache.clear();
}

/**
 * 注册新的定损服务（用于动态扩展）
 * @param {string} insuranceType - 险种类型
 * @param {Function} loader - 动态导入函数
 */
export function registerAssessmentService(insuranceType, loader) {
  const type = insuranceType.toUpperCase();
  assessmentServices[type] = loader;
  clearServiceCache(); // 清空缓存以便下次重新加载
  console.log(`注册定损服务: ${type}`);
}

export default {
  getAssessmentService,
  assessDamage,
  getSupportedInsuranceTypes,
  clearServiceCache,
  registerAssessmentService,
};
