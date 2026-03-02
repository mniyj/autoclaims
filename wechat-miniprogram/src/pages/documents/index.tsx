// 智能理赔微信小程序 - 文档查看页面（适配Taro）

import React, { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, Image } from '@tarojs/components';
import { ClaimDocument } from '../../types';
import './index.scss';

interface DocCategory {
  name: string;
  icon: string;
  color: string;
}

function DocumentsPage() {
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);

  const categories: DocCategory[] = [
    { name: '医疗发票', icon: '📄', color: '#1890ff' },
    { name: '出院小结', icon: '📋', color: '#52c41a' },
    { name: '诊断证明', icon: '🏥', color: '#f56c6c' },
    { name: '现场照片', icon: '📷', color: '#07c160' },
    { name: '其他材料', icon: '📁', color: '#faad14' }
  ];

  useEffect(() => {
    // 加载已上传的文档
    const savedDocs = Taro.getStorageSync('documents');
    if (savedDocs) {
      setDocuments(JSON.parse(savedDocs));
    }
  }, []);

  // 保存文档到本地存储
  useEffect(() => {
    Taro.setStorageSync('documents', JSON.stringify(documents));
  }, [documents]);

  const handlePreview = (doc: ClaimDocument) => {
    if (doc.url) {
      Taro.previewImage({
        current: doc.url,
        success: () => {
          console.log('预览成功');
        },
        fail: (err) => {
          console.error('预览失败:', err);
        }
      });
    } else {
      Taro.showToast({
        title: '文件暂无URL',
        icon: 'none'
      });
    }
  };

  const handleDelete = (docId: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个文档吗？',
      success: () => {
        const updatedDocs = documents.filter(d => d.id !== docId);
        setDocuments(updatedDocs);
        Taro.setStorageSync('documents', JSON.stringify(updatedDocs));
        Taro.showToast({
          title: '已删除',
          icon: 'success'
        });
      }
    });
  };

  const filteredDocs = (category?: string) => {
    if (!category) return documents;
    return documents.filter(doc => doc.category === category);
  };

  return (
    <View className="documents-page">
      {/* 顶部栏 */}
      <View className="docs-header">
        <Button size="mini" onClick={() => Taro.navigateBack()}>
          返回
        </Button>
        <Text className="header-title">我的文档</Text>
      </View>

      {/* 分类标签 */}
      <View className="category-tabs">
        {categories.map((cat, index) => (
          <View
            key={cat.name}
            className={`category-tab ${index === 0 ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.name)}
          >
            <Text className="tab-icon">{cat.icon}</Text>
            <Text className="tab-name">{cat.name}</Text>
          </View>
        ))}
      </View>

      {/* 文档列表 */}
      <View className="docs-list">
        {filteredDocs.map((doc, index) => (
          <View key={doc.id} className="doc-item">
            <View className="doc-preview">
              {doc.url ? (
                <Image
                  src={doc.url}
                  className="doc-thumbnail"
                  mode="aspectFill"
                  lazyLoad
                  onClick={() => handlePreview(doc)}
                />
              ) : (
                <View className="doc-placeholder">
                  <Text className="placeholder-icon">?</Text>
                </View>
              )}
            </View>

            <View className="doc-info">
              <Text className="doc-name">{doc.name}</Text>

              <View className="doc-meta">
                <Text className="doc-status">
                  {doc.status === 'verified' && '✓ 已认证'}
                  {doc.status === 'pending' && '⏳ 待审核'}
                  {doc.status === 'rejected' && '✗ 不通过'}
                </Text>
              </View>
            </View>

            <View className="doc-actions">
              <Button
                size="mini"
                onClick={() => handleDelete(doc.id)}
              >
                删除
              </Button>
            </View>
          </View>
        ))}
      </View>

      {/* 空状态 */}
      {documents.length === 0 && (
        <View className="empty-state">
          <Image
            src="https://via.placeholder.com/150"
            className="empty-image"
            mode="aspectFit"
          />
          <Text className="empty-text">暂无文档</Text>
        </View>
      )}
    </View>
  );
}

function setSelectedCategory(category: string) {
  // TODO: 实现分类筛选
  console.log('选择分类:', category);
}

export default DocumentsPage;
