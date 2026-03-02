/**
 * 测试材料样例功能
 * 验证 ossKey 字段是否正确传递
 */

import { calculateMaterials } from './services/materialCalculator.js';

async function testMaterialSample() {
  console.log('=== 测试材料样例功能 ===\n');

  // 测试场景：计算意外险的材料清单
  const params = {
    productCode: 'ACC-001',
    categoryCode: 'accident',
    claimItemIds: ['item-1', 'item-2'],
    accidentCauseId: 'cause-1'
  };

  console.log('测试参数:', JSON.stringify(params, null, 2));
  console.log('\n计算材料清单...\n');

  const result = await calculateMaterials(params);

  if (result.success) {
    console.log('✅ 计算成功！');
    console.log(`\n材料统计:`);
    console.log(`  - 总数: ${result.summary.totalCount}`);
    console.log(`  - 必填: ${result.summary.requiredCount}`);
    console.log(`  - 可选: ${result.summary.optionalCount}`);

    console.log('\n材料清单:');
    result.materials.forEach((mat, index) => {
      console.log(`\n${index + 1}. ${mat.materialName} ${mat.required ? '(必填)' : '(可选)'}`);
      console.log(`   ID: ${mat.materialId}`);
      console.log(`   来源: ${mat.sourceDetails}`);
      console.log(`   样例URL: ${mat.sampleUrl || '无'}`);
      console.log(`   OSS Key: ${mat.ossKey || '无'}`);
      
      // 检查 ossKey 字段
      if (mat.sampleUrl && !mat.ossKey) {
        console.log('   ⚠️  警告: 有 sampleUrl 但缺少 ossKey');
      } else if (mat.ossKey) {
        console.log('   ✅ ossKey 字段正常');
      }
    });

    // 统计有样例的材料
    const withSample = result.materials.filter(m => m.sampleUrl || m.ossKey);
    console.log(`\n有样例的材料: ${withSample.length}/${result.materials.length}`);

  } else {
    console.log('❌ 计算失败:', result.error);
  }
}

// 运行测试
testMaterialSample().catch(console.error);
