// 优化后的文件处理流程
// 替换 App.tsx 中的 processFiles 函数

import { analyzeDocumentOptimized, analyzeBatch, quickAnalyze, deepAnalyze } from './geminiService.optimized';

// 方案1: 使用优化的单文件处理（推荐用于混合文档类型）
const processFilesOptimized = async (files: FileList | File[]) => {
  setIsLoading(true);
  const fileArray = Array.from(files);
  const limitedFiles = fileArray.slice(0, MAX_FILES_PER_UPLOAD);
  
  if (limitedFiles.length === 0) {
    setIsLoading(false);
    return;
  }

  // 1. 快速读取文件（并行）
  const fileReadPromises = limitedFiles.map((file) =>
    file.type.startsWith('image/') ? createImageAttachment(file) : createFileAttachment(file)
  );
  const newAttachments = await Promise.all(fileReadPromises);

  // 2. 立即显示用户消息
  const userMsg: Message = { 
    id: `upload-${Date.now()}`, 
    role: 'user', 
    content: `已上传 ${newAttachments.length} 份文件`, 
    timestamp: Date.now(), 
    attachments: newAttachments 
  };
  setMessages(prev => [...prev, userMsg]);

  setUploadProgress({ total: newAttachments.length, completed: 0, failed: 0, active: 0 });
  setIsAnalyzing('智能识别中...');

  let completedCount = 0;
  let failedCount = 0;
  const results: Array<Attachment & { status: 'success' | 'failed' }> = new Array(newAttachments.length);
  
  // 3. 使用优化的并发处理（更快的模型 + 简化 Prompt）
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= newAttachments.length) return;
      const att = newAttachments[current];
      
      setUploadProgress(prev => ({
        ...prev,
        currentFile: att.name,
        active: prev.active + 1
      }));
      
      try {
        // 使用优化的分析函数（更快的模型 + 缓存）
        const analysis = await analyzeDocumentOptimized(att.base64!, att.type, claimState);
        completedCount++;
        
        setUploadProgress(prev => ({
          ...prev,
          completed: completedCount,
          active: Math.max(0, prev.active - 1)
        }));
        
        results[current] = { ...att, analysis, status: 'success' };
      } catch (err) {
        console.error(`Analysis failed for ${att.name}:`, err);
        failedCount++;
        
        setUploadProgress(prev => ({
          ...prev,
          failed: failedCount,
          active: Math.max(0, prev.active - 1)
        }));
        
        results[current] = { ...att, status: 'failed', error: String(err) };
      }
    }
  };
  
  // 提高并发数到 15（因为使用了更快的模型）
  const workerCount = Math.min(15, newAttachments.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  
  const analyzedAttachments = results.filter(Boolean);
  
  // 4. 清理 base64 减少内存占用
  const cleanedAttachments = analyzedAttachments.map(att => {
    if (att.type.includes('image') && att.url) return { ...att, base64: undefined };
    return att;
  });

  setIsAnalyzing(null);
  setPendingFiles(cleanedAttachments);
  setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, attachments: cleanedAttachments } : m));
  
  // 5. 生成摘要
  const categoryCounts = cleanedAttachments.reduce((acc, curr) => {
    const cat = curr.analysis?.category || '未知类型';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const summaryStr = Object.entries(categoryCounts)
    .map(([cat, count]) => `${cat} x${count}`)
    .join('，');
  
  const hasErrors = cleanedAttachments.some(hasMissingFields);
  const contentPrefix = hasErrors 
    ? `⚠️ 发现 ${cleanedAttachments.length} 份文件，但部分文件缺失关键信息，请检查：` 
    : `✅ 已完成 ${cleanedAttachments.length} 份文件的智能识别 (${summaryStr})，详情如下：`;

  setMessages(prev => [...prev, {
    id: `analysis-${Date.now()}`,
    role: 'assistant',
    content: contentPrefix,
    timestamp: Date.now(),
    analysisResults: cleanedAttachments,
    intentChoice: !hasErrors
  }]);

  setUploadProgress({ total: 0, completed: 0, failed: 0, active: 0 });
  setIsLoading(false);
};


// 方案2: 批量处理（推荐用于大量同类文档）
const processFilesBatch = async (files: FileList | File[]) => {
  setIsLoading(true);
  const fileArray = Array.from(files);
  const limitedFiles = fileArray.slice(0, MAX_FILES_PER_UPLOAD);
  
  if (limitedFiles.length === 0) {
    setIsLoading(false);
    return;
  }

  // 1. 读取所有文件
  const fileReadPromises = limitedFiles.map((file) =>
    file.type.startsWith('image/') ? createImageAttachment(file) : createFileAttachment(file)
  );
  const newAttachments = await Promise.all(fileReadPromises);

  const userMsg: Message = { 
    id: `upload-${Date.now()}`, 
    role: 'user', 
    content: `已上传 ${newAttachments.length} 份文件`, 
    timestamp: Date.now(), 
    attachments: newAttachments 
  };
  setMessages(prev => [...prev, userMsg]);

  setIsAnalyzing('批量识别中...');

  try {
    // 2. 批量处理（每批 5 个文件，减少单次请求大小）
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < newAttachments.length; i += BATCH_SIZE) {
      batches.push(newAttachments.slice(i, i + BATCH_SIZE));
    }

    const allResults = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchFiles = batch.map(att => ({
        base64: att.base64!,
        mimeType: att.type,
        name: att.name
      }));

      setIsAnalyzing(`处理批次 ${i + 1}/${batches.length}...`);
      
      // 批量调用 API（一次请求处理多个文件）
      const batchResults = await analyzeBatch(batchFiles, claimState);
      
      // 合并结果
      batch.forEach((att, idx) => {
        allResults.push({
          ...att,
          analysis: batchResults[idx],
          status: 'success'
        });
      });
    }

    const cleanedAttachments = allResults.map(att => ({
      ...att,
      base64: att.type.includes('image') && att.url ? undefined : att.base64
    }));

    setIsAnalyzing(null);
    setPendingFiles(cleanedAttachments);
    
    const categoryCounts = cleanedAttachments.reduce((acc, curr) => {
      const cat = curr.analysis?.category || '未知类型';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const summaryStr = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat} x${count}`)
      .join('，');

    setMessages(prev => [...prev, {
      id: `analysis-${Date.now()}`,
      role: 'assistant',
      content: `✅ 已完成 ${cleanedAttachments.length} 份文件的批量识别 (${summaryStr})`,
      timestamp: Date.now(),
      analysisResults: cleanedAttachments,
      intentChoice: true
    }]);

  } catch (err) {
    console.error('Batch analysis failed:', err);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: '批量识别失败，请重试',
      timestamp: Date.now()
    }]);
  }

  setIsAnalyzing(null);
  setIsLoading(false);
};


// 方案3: 两阶段处理（快速预览 + 按需深度解析）
const processFilesTwoStage = async (files: FileList | File[]) => {
  setIsLoading(true);
  const fileArray = Array.from(files);
  const limitedFiles = fileArray.slice(0, MAX_FILES_PER_UPLOAD);
  
  if (limitedFiles.length === 0) {
    setIsLoading(false);
    return;
  }

  const fileReadPromises = limitedFiles.map((file) =>
    file.type.startsWith('image/') ? createImageAttachment(file) : createFileAttachment(file)
  );
  const newAttachments = await Promise.all(fileReadPromises);

  const userMsg: Message = { 
    id: `upload-${Date.now()}`, 
    role: 'user', 
    content: `已上传 ${newAttachments.length} 份文件`, 
    timestamp: Date.now(), 
    attachments: newAttachments 
  };
  setMessages(prev => [...prev, userMsg]);

  setIsAnalyzing('快速识别中...');

  // 阶段1: 快速识别文档类型（使用最快的模型）
  const quickResults = await Promise.all(
    newAttachments.map(async (att) => {
      try {
        const quick = await quickAnalyze(att.base64!, att.type);
        return { ...att, quickAnalysis: quick };
      } catch (err) {
        return { ...att, quickAnalysis: { category: '未知', needsDeepAnalysis: false } };
      }
    })
  );

  // 立即显示快速识别结果
  setMessages(prev => [...prev, {
    id: `quick-${Date.now()}`,
    role: 'assistant',
    content: `✅ 快速识别完成，共 ${quickResults.length} 份文件`,
    timestamp: Date.now(),
    analysisResults: quickResults.map(r => ({
      ...r,
      analysis: {
        category: r.quickAnalysis.category,
        clarityScore: 0,
        completenessScore: 0,
        summary: '快速识别',
        missingFields: [],
        ocr: {}
      }
    })),
    intentChoice: true
  }]);

  setIsAnalyzing(null);
  setIsLoading(false);

  // 阶段2: 后台深度解析（仅对需要的文档）
  const needsDeep = quickResults.filter(r => r.quickAnalysis.needsDeepAnalysis);
  if (needsDeep.length > 0) {
    setTimeout(async () => {
      for (const att of needsDeep) {
        try {
          const deepData = await deepAnalyze(
            att.base64!, 
            att.type, 
            att.quickAnalysis.category, 
            claimState
          );
          // 更新对应文件的详细信息
          console.log(`Deep analysis completed for ${att.name}`, deepData);
        } catch (err) {
          console.error(`Deep analysis failed for ${att.name}`, err);
        }
      }
    }, 1000);
  }
};

export { processFilesOptimized, processFilesBatch, processFilesTwoStage };
