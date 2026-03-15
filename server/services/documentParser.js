/**
 * 文档解析服务
 * 支持 PDF、Word、Excel 等多种文档格式的解析
 */

import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isMissingModuleError(error) {
  const code = error?.code || '';
  const message = error?.message || '';
  return code === 'MODULE_NOT_FOUND'
    || code === 'ERR_MODULE_NOT_FOUND'
    || message.includes('module not installed')
    || message.includes('Cannot find package');
}

function createTempFile(buffer, extension) {
  const tempPath = path.join(
    os.tmpdir(),
    `claim-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  );
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

async function withTempFile(buffer, extension, handler) {
  const tempPath = createTempFile(buffer, extension);
  try {
    return await handler(tempPath);
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

// ============================================================================
// PDF 解析器
// ============================================================================

/**
 * 使用 pdf-parse 解析 PDF 文件（纯文本提取）
 * @param {Buffer} buffer - PDF 文件 Buffer
 * @returns {Promise<{text: string, pages: number, metadata: object}>}
 */
export async function parsePDF(buffer) {
  try {
    // 动态导入 pdf-parse（需要安装：npm install pdf-parse）
    const pdfParse = await import('pdf-parse').then(m => m.default || m);

    const data = await pdfParse(buffer);

    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      metadata: {
        info: data.info,
        version: data.version,
      },
    };
  } catch (error) {
    if (isMissingModuleError(error)) {
      console.warn('[documentParser] pdf-parse not installed, using python fallback');
      return withTempFile(buffer, 'pdf', async (filePath) => {
        const fallback = await parsePDFWithTables(filePath);
        return {
          success: fallback.success,
          text: fallback.text || '',
          pages: fallback.pages || 0,
          tables: fallback.tables || [],
          metadata: {},
          error: fallback.error,
        };
      });
    }
    throw error;
  }
}

/**
 * 使用 Python pdfplumber 解析 PDF（支持表格提取）
 * @param {string} filePath - PDF 文件路径
 * @returns {Promise<{text: string, tables: array[], pages: number}>}
 */
export async function parsePDFWithTables(filePath) {
  return new Promise((resolve, reject) => {
    const script = `
import pdfplumber
import json
import sys

try:
    result = {"text": "", "tables": [], "pages": 0}
    with pdfplumber.open(sys.argv[1]) as pdf:
        result["pages"] = len(pdf.pages)
        for page in pdf.pages:
            result["text"] += page.extract_text() or ""
            tables = page.extract_tables()
            for table in tables:
                if table:
                    result["tables"].append(table)
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

    const python = spawn('python3', ['-c', script, filePath]);
    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          text: '',
          tables: [],
          pages: 0,
          error: errorOutput || 'Python pdfplumber failed',
        });
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve({
          success: !result.error,
          text: result.text || '',
          tables: result.tables || [],
          pages: result.pages || 0,
          error: result.error,
        });
      } catch (e) {
        resolve({
          success: false,
          text: '',
          tables: [],
          pages: 0,
          error: 'Failed to parse Python output',
        });
      }
    });
  });
}

// ============================================================================
// Word 解析器
// ============================================================================

/**
 * 使用 mammoth 解析 Word 文档（提取文本）
 * @param {Buffer} buffer - Word 文件 Buffer
 * @returns {Promise<{text: string, messages: array}>}
 */
export async function parseWord(buffer) {
  try {
    // 动态导入 mammoth（需要安装：npm install mammoth）
    const mammoth = await import('mammoth').then(m => m.default || m);

    const result = await mammoth.extractRawText({ buffer });

    return {
      success: true,
      text: result.value,
      messages: result.messages,
    };
  } catch (error) {
    if (isMissingModuleError(error)) {
      console.warn('[documentParser] mammoth not installed, using textutil fallback');
      return withTempFile(buffer, 'docx', async (filePath) => {
        const { stdout } = await runCommand('/usr/bin/textutil', ['-convert', 'txt', '-stdout', filePath]);
        return {
          success: true,
          text: stdout,
          messages: ['textutil_fallback'],
        };
      });
    }
    throw error;
  }
}

/**
 * 使用 mammoth 将 Word 转换为 HTML
 * @param {Buffer} buffer - Word 文件 Buffer
 * @returns {Promise<{html: string, messages: array}>}
 */
export async function parseWordToHTML(buffer) {
  try {
    const mammoth = await import('mammoth').then(m => m.default || m);

    const result = await mammoth.convertToHtml({ buffer });

    return {
      success: true,
      html: result.value,
      messages: result.messages,
    };
  } catch (error) {
    if (isMissingModuleError(error)) {
      return withTempFile(buffer, 'docx', async (filePath) => {
        const { stdout } = await runCommand('/usr/bin/textutil', ['-convert', 'html', '-stdout', filePath]);
        return {
          success: true,
          html: stdout,
          messages: ['textutil_fallback'],
        };
      });
    }
    throw error;
  }
}

// ============================================================================
// Excel 解析器
// ============================================================================

/**
 * 使用 xlsx 解析 Excel 文件
 * @param {Buffer} buffer - Excel 文件 Buffer
 * @returns {Promise<{sheets: object, data: array[]}>}
 */
export async function parseExcel(buffer) {
  try {
    // 动态导入 xlsx（需要安装：npm install xlsx）
    const XLSX = await import('xlsx').then(m => m.default || m);

    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheets = {};
    const allData = [];

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      sheets[sheetName] = jsonData;
      allData.push(...jsonData);
    });

    return {
      success: true,
      sheets,
      data: allData,
      sheetNames: workbook.SheetNames,
    };
  } catch (error) {
    if (isMissingModuleError(error)) {
      console.warn('[documentParser] xlsx not installed, using fallback');
      return {
        success: false,
        sheets: {},
        data: [],
        sheetNames: [],
        error: 'xlsx module not installed. Run: npm install xlsx',
      };
    }
    throw error;
  }
}

/**
 * 解析 Excel 并转换为结构化对象数组
 * @param {Buffer} buffer - Excel 文件 Buffer
 * @param {string} sheetName - 工作表名称（可选，默认第一个）
 * @returns {Promise<{data: object[], headers: string[]}>}
 */
export async function parseExcelToObjects(buffer, sheetName = null) {
  try {
    const XLSX = await import('xlsx').then(m => m.default || m);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const targetSheet = sheetName || workbook.SheetNames[0];

    if (!workbook.Sheets[targetSheet]) {
      return {
        success: false,
        data: [],
        headers: [],
        error: `Sheet "${targetSheet}" not found`,
      };
    }

    const worksheet = workbook.Sheets[targetSheet];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // 提取表头
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

    return {
      success: true,
      data: jsonData,
      headers,
      sheetName: targetSheet,
    };
  } catch (error) {
    if (isMissingModuleError(error)) {
      return {
        success: false,
        data: [],
        headers: [],
        error: 'xlsx module not installed. Run: npm install xlsx',
      };
    }
    throw error;
  }
}

// ============================================================================
// 通用文档解析器
// ============================================================================

/**
 * 根据文件类型自动选择解析器
 * @param {Buffer} buffer - 文件 Buffer
 * @param {string} mimeType - MIME 类型
 * @param {object} options - 解析选项
 * @returns {Promise<{text: string, structuredData: object, metadata: object}>}
 */
export async function parseDocument(buffer, mimeType, options = {}) {
  const startTime = Date.now();

  let result = {
    success: false,
    text: '',
    structuredData: {},
    metadata: {},
    parseTime: 0,
  };

  try {
    // PDF 文件
    if (mimeType === 'application/pdf') {
      const pdfResult = await parsePDF(buffer);
      result = {
        success: pdfResult.success,
        text: pdfResult.text,
        structuredData: {
          pages: pdfResult.pages,
          tables: pdfResult.tables || [],
        },
        metadata: pdfResult.metadata || {},
        error: pdfResult.error,
      };
    }
    // Word 文档
    else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const wordResult = await parseWord(buffer);
      result = {
        success: wordResult.success,
        text: wordResult.text,
        structuredData: {},
        metadata: { messages: wordResult.messages },
        error: wordResult.error,
      };
    }
    // Excel 文件
    else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      const excelResult = options.sheetName
        ? await parseExcelToObjects(buffer, options.sheetName)
        : await parseExcel(buffer);
      result = {
        success: excelResult.success,
        text: '', // Excel 通常不需要文本
        structuredData: {
          sheets: excelResult.sheets,
          data: excelResult.data,
          headers: excelResult.headers,
          sheetNames: excelResult.sheetNames,
        },
        metadata: {},
        error: excelResult.error,
      };
    }
    // 纯文本
    else if (mimeType.startsWith('text/')) {
      result = {
        success: true,
        text: buffer.toString('utf-8'),
        structuredData: {},
        metadata: {},
      };
    }
    // 不支持的类型
    else {
      result = {
        success: false,
        text: '',
        structuredData: {},
        metadata: {},
        error: `Unsupported MIME type: ${mimeType}`,
      };
    }
  } catch (error) {
    result = {
      success: false,
      text: '',
      structuredData: {},
      metadata: {},
      error: error.message,
    };
  }

  result.parseTime = Date.now() - startTime;
  return result;
}

// ============================================================================
// 导出
// ============================================================================

export default {
  parsePDF,
  parsePDFWithTables,
  parseWord,
  parseWordToHTML,
  parseExcel,
  parseExcelToObjects,
  parseDocument,
};
