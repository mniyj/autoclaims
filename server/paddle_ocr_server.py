#!/usr/bin/env python3
"""
PaddleOCR Flask 服务
启动命令: python paddle_ocr_server.py
默认端口: 8866
"""

import base64
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
from paddleocr import PaddleOCR

app = Flask(__name__)
CORS(app)

# 初始化 PaddleOCR (首次运行会自动下载模型)
print("正在初始化 PaddleOCR...")
ocr = PaddleOCR(use_angle_cls=True, lang='ch', show_log=False)
print("PaddleOCR 初始化完成!")


def decode_base64_image(data_uri: str) -> Image.Image:
    """解码 base64 图片"""
    # 移除 data URI 前缀
    if ',' in data_uri:
        data_uri = data_uri.split(',')[1]
    
    image_data = base64.b64decode(data_uri)
    image = Image.open(io.BytesIO(image_data))
    
    # 转换为 RGB (处理 RGBA 或其他格式)
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    return image


@app.route('/predict/ocr_system', methods=['POST'])
def predict():
    """OCR 识别接口"""
    try:
        data = request.get_json()
        
        if not data or 'images' not in data:
            return jsonify({'error': 'Missing images field'}), 400
        
        images = data['images']
        if not images or len(images) == 0:
            return jsonify({'error': 'No images provided'}), 400
        
        results = []
        
        for img_data in images:
            # 解码图片
            image = decode_base64_image(img_data)
            
            # 转为 numpy array
            img_array = np.array(image)
            
            # 执行 OCR
            ocr_result = ocr.ocr(img_array, cls=True)
            
            # 处理结果
            # PaddleOCR 返回格式: [[[box], (text, confidence)], ...]
            items = []
            if ocr_result and ocr_result[0]:
                for line in ocr_result[0]:
                    box = line[0]  # 文字区域坐标
                    text = line[1][0]  # 识别文字
                    confidence = line[1][1]  # 置信度
                    
                    items.append({
                        'text': text,
                        'confidence': float(confidence),
                        'text_region': box
                    })
            
            results.append({'data': items})
        
        return jsonify({'results': results})
    
    except Exception as e:
        print(f"OCR Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({'status': 'ok', 'service': 'PaddleOCR'})


if __name__ == '__main__':
    print("\n" + "=" * 50)
    print("PaddleOCR 服务启动")
    print("端口: 8866")
    print("接口: POST /predict/ocr_system")
    print("健康检查: GET /health")
    print("=" * 50 + "\n")
    
    app.run(host='0.0.0.0', port=8866, debug=False)
