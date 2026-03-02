// 智能理赔微信小程序 - 进度查询页面（适配Taro）

import React, { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { HistoricalClaim, ClaimStatus } from '../../types';
import { MOCK_HISTORICAL_CLAIMS } from '../../constants';
import './index.scss';

function ProgressPage() {
  const [claims, setClaims] = useState<HistoricalClaim[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | ClaimStatus>('all');

  useEffect(() => {
    // 加载历史理赔数据
    const savedClaims = Taro.getStorageSync('historicalClaims');
    if (savedClaims) {
      setClaims(JSON.parse(savedClaims));
    }
  }, []);

  // 过滤理赔
  const filteredClaims = filterStatus === 'all'
    ? claims
    : claims.filter(claim => claim.status === filterStatus);

  return (
    <View className="progress-page">
      {/* 顶部栏 */}
      <View className="progress-header">
        <Text className="header-title">理赔进度</Text>
      </View>

      {/* 状态筛选 */}
      <View className="status-filters">
        <View
          className={`filter-item ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          <Text>全部</Text>
        </View>
        <View
          className={`filter-item ${filterStatus === ClaimStatus.REPORTING ? 'active' : ''}`}
          onClick={() => setFilterStatus(ClaimStatus.REPORTING)}
        >
          <Text>报案中</Text>
        </View>
        <View
          className={`filter-item ${filterStatus === ClaimStatus.DOCUMENTING ? 'active' : ''}`}
          onClick={() => setFilterStatus(ClaimStatus.DOCUMENTING)}
        >
          <Text>审核中</Text>
        </View>
        <View
          className={`filter-item ${filterStatus === ClaimStatus.REVIEWING ? 'active' : ''}`}
          onClick={() => setFilterStatus(ClaimStatus.REVIEWING)}
        >
          <Text>评估中</Text>
        </View>
        <View
          className={`filter-item ${filterStatus === ClaimStatus.SETTLED ? 'active' : ''}`}
          onClick={() => setFilterStatus(ClaimStatus.SETTLED)}
        >
          <Text>已结案</Text>
        </View>
        <View
          className={`filter-item ${filterStatus === ClaimStatus.REJECTED ? 'active' : ''}`}
          onClick={() => setFilterStatus(ClaimStatus.REJECTED)}
        >
          <Text>已拒赔</Text>
        </View>
      </View>

      {/* 理赔列表 */}
      <View className="claims-list">
        {filteredClaims.map((claim) => (
          <View key={claim.id} className="claim-card">
            <View className="claim-header">
              <Text className="claim-type">{claim.type}</Text>
              <Text className="claim-date">{claim.date}</Text>
              <View className={`claim-status ${claim.status}`}>
                <Text className="status-text">
                  {claim.status === ClaimStatus.REPORTING && '报案中'}
                  {claim.status === ClaimStatus.DOCUMENTING && '审核中'}
                  {claim.status === ClaimStatus.REVIEWING && '评估中'}
                  {claim.status === ClaimStatus.SETTLED && '已结案'}
                  {claim.status === ClaimStatus.PAID && '已赔付'}
                  {claim.status === ClaimStatus.REJECTED && '已拒赔'}
                </Text>
              </View>
            </View>

            <Text className="claim-amount">
              {claim.amount ? `¥${claim.amount}` : '未定'}
            </Text>
          </View>

          <View className="claim-content">
            {claim.incidentReason && (
              <View className="claim-reason">
                <Text className="reason-label">事故原因:</Text>
                <Text className="reason-text">{claim.incidentReason}</Text>
              </View>
            )}

            {claim.insuredName && (
              <View className="claim-insured">
                <Text className="insured-label">被保险人:</Text>
                <Text className="insured-name">{claim.insuredName}</Text>
              </View>
            )}
          </View>

          <View className="claim-footer">
            <Button size="mini" onClick={() => handleViewDetail(claim.id)}>
              查看详情
            </Button>
          </View>
        </View>
      ))}
      </View>
    </View>
  );
}

const handleViewDetail = (claimId: string) => {
  Taro.setStorageSync('selectedClaimId', claimId);
  Taro.navigateTo({
    url: '/pages/chat/index'
  });
};

export default ProgressPage;
