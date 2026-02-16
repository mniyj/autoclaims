import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClaimStatus, Message, ClaimState, ClaimDocument, HistoricalClaim, Policy, Attachment, MedicalInvoiceData, OCRData, DischargeSummaryData } from './types';
import { MOCK_POLICIES, MOCK_HISTORICAL_CLAIMS } from './constants';
import { getAIResponse, analyzeDocument, quickAnalyze, connectLive, transcribeAudio } from './geminiService';
import { getSignedUrl } from './ossService';
import { logUserOperation } from './logService';
import { UserOperationType } from '../types';
import type { AIInteractionLog } from '../types';

// --- Helpers ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const getDocIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'fa-file-pdf';
  if (lowerName.includes('身份') || lowerName.includes('证')) return 'fa-id-card';
  if (lowerName.includes('票') || lowerName.includes('凭证') || lowerName.includes('清单')) return 'fa-receipt';
  if (lowerName.includes('小结') || lowerName.includes('出院') || lowerName.includes('记录')) return 'fa-file-waveform';
  if (lowerName.includes('照片') || lowerName.includes('现场')) return 'fa-camera-retro';
  if (lowerName.includes('诊断') || lowerName.includes('报告')) return 'fa-file-medical';
  return 'fa-file-lines';
};

const getStatusLabel = (status: ClaimStatus) => {
  switch (status) {
    case ClaimStatus.REPORTING: return '报案登记';
    case ClaimStatus.DOCUMENTING: return '补充材料';
    case ClaimStatus.REVIEWING: return '智能审核';
    case ClaimStatus.SETTLED: return '审核完成';
    case ClaimStatus.PAID: return '已打款';
    case ClaimStatus.REJECTED: return '已拒赔';
    default: return '处理中';
  }
};

const hasMissingFields = (doc: Attachment) => {
  return doc.analysis?.missingFields && doc.analysis.missingFields.length > 0;
};

const STORAGE_KEY = 'smartclaim_v9_history';
const MAX_FILES_PER_UPLOAD = 20;
const MAX_CONCURRENT_ANALYSIS = 10;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.82;

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error('file_read_failed'));
  reader.readAsDataURL(file);
});

const createImageAttachment = (file: File) => new Promise<Attachment>((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve({ base64: '', type: file.type, name: file.name, url });
      return;
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
    resolve({ base64: dataUrl.split(',')[1], type: 'image/jpeg', name: file.name, url });
  };
  image.onerror = async () => {
    const dataUrl = await readFileAsDataUrl(file);
    resolve({ base64: dataUrl.split(',')[1], type: file.type, name: file.name, url });
  };
  image.src = url;
});

const createFileAttachment = async (file: File): Promise<Attachment> => {
  const dataUrl = await readFileAsDataUrl(file);
  return { base64: dataUrl.split(',')[1], type: file.type, name: file.name };
};

// --- Components ---

// Simple Card
const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => {
  return (
    <div onClick={onClick} className={`glass-card p-4 relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-lg active:scale-95' : ''} ${className}`}>
      {children}
    </div>
  );
};

// Medical Data Display Component
const MedicalDataDisplay = ({ data }: { data: MedicalInvoiceData }) => {
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-4 text-xs space-y-4 border border-slate-100 shadow-inner">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
        <div><span className="text-slate-400">医院:</span> <span className="font-bold text-slate-700 ml-1">{data.invoiceInfo?.hospitalName || '-'}</span></div>
        <div><span className="text-slate-400">姓名:</span> <span className="font-bold text-slate-700 ml-1">{data.basicInfo?.name || '-'}</span></div>
        <div><span className="text-slate-400">科室:</span> <span className="text-slate-600 ml-1">{data.basicInfo?.department || '-'}</span></div>
        <div><span className="text-slate-400">时间:</span> <span className="text-slate-600 ml-1">{data.invoiceInfo?.issueDate || '-'}</span></div>
      </div>

      {/* Amounts */}
      <div className="bg-white rounded-lg p-3 border border-slate-100 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-slate-400 scale-90 origin-left">总金额</span>
          <span className="text-base font-bold text-slate-800">¥{data.totalAmount || 0}</span>
        </div>
        <div className="h-8 w-px bg-slate-100"></div>
        <div className="flex flex-col items-end">
          <span className="text-slate-400 scale-90 origin-right">医保支付</span>
          <span className="text-slate-600">¥{data.insurancePayment?.governmentFundPayment || 0}</span>
        </div>
        <div className="h-8 w-px bg-slate-100"></div>
        <div className="flex flex-col items-end">
          <span className="text-slate-400 scale-90 origin-right">个人支付</span>
          <span className="text-blue-600 font-bold">¥{data.insurancePayment?.personalPayment || 0}</span>
        </div>
      </div>

      {/* Items List */}
      {data.chargeItems && data.chargeItems.length > 0 && (
        <div>
          <div className="text-slate-400 mb-2 font-bold scale-90 origin-left">收费明细</div>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {data.chargeItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1 last:border-0">
                <div className="flex-1 truncate mr-2 text-slate-600" title={item.itemName}>{item.itemName}</div>
                <div className="text-slate-400 scale-90 whitespace-nowrap">{item.quantity} x {item.unitPrice}</div>
                <div className="w-16 text-right font-medium text-slate-700">¥{item.totalPrice}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
};

// Discharge Summary Data Display Component
const DischargeSummaryDisplay = ({ data }: { data: DischargeSummaryData }) => {
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-4 text-xs space-y-4 border border-slate-100 shadow-inner animate-enter">
      {/* Hospital Header */}
      <div className="text-center border-b border-slate-200 pb-2 mb-2">
        <div className="font-bold text-base text-slate-800">{data.hospital_info?.hospital_name}</div>
        <div className="text-slate-500 mt-0.5">{data.hospital_info?.department} - {data.document_type}</div>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-slate-100">
        <div><span className="text-slate-400">姓名:</span> <span className="font-bold ml-1">{data.patient_info?.name}</span></div>
        <div><span className="text-slate-400">性别/年龄:</span> <span className="ml-1">{data.patient_info?.gender} / {data.patient_info?.age}岁</span></div>
        <div><span className="text-slate-400">入院:</span> <span className="ml-1">{data.admission_details?.admission_date?.split(' ')[0]}</span></div>
        <div><span className="text-slate-400">出院:</span> <span className="ml-1">{data.discharge_details?.discharge_date?.split(' ')[0]} ({data.discharge_details?.hospital_stay_days}天)</span></div>
      </div>

      {/* Admission Details */}
      {(data.admission_details?.main_symptoms_on_admission || data.admission_details?.admission_condition_summary) && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><i className="fas fa-right-to-bracket text-blue-500"></i> 入院情况</div>
          <div className="bg-white p-2 rounded border border-slate-100 leading-relaxed text-slate-600">
            {data.admission_details?.main_symptoms_on_admission && <div className="mb-1"><span className="text-slate-400">主诉:</span> {data.admission_details.main_symptoms_on_admission}</div>}
            {data.admission_details?.admission_condition_summary && <div><span className="text-slate-400">查体:</span> {data.admission_details.admission_condition_summary}</div>}
          </div>
        </div>
      )}

      {/* Diagnoses */}
      <div>
        <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><i className="fas fa-stethoscope text-blue-500"></i> 诊断信息</div>
        <div className="space-y-1">
          {data.diagnoses?.map((d, i) => (
            <div key={i} className="flex flex-col bg-white p-2 rounded border border-slate-100">
              <div className="flex justify-between items-start">
                <span className="font-medium text-slate-700">{d.diagnosis_name}</span>
                <span className="text-slate-400 text-[10px] px-1.5 py-0.5 bg-slate-100 rounded whitespace-nowrap">{d.diagnosis_type}</span>
              </div>
              {d.notes && <div className="text-[10px] text-slate-400 mt-1">Note: {d.notes}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Treatments & Surgery */}
      {data.main_treatments_during_hospitalization && data.main_treatments_during_hospitalization.length > 0 && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><i className="fas fa-syringe text-blue-500"></i> 诊疗操作</div>
          <div className="space-y-1">
            {data.main_treatments_during_hospitalization.map((t, i) => (
              <div key={i} className="bg-white p-2 rounded border border-slate-100">
                <div className="font-medium text-slate-700">{t.treatment_name}</div>
                {t.description && <div className="text-slate-500 text-[10px] mt-0.5">{t.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Summary */}
      {data.hospitalization_course_summary && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><i className="fas fa-file-waveform text-blue-500"></i> 住院经过</div>
          <p className="bg-white p-2 rounded border border-slate-100 leading-relaxed text-slate-600">
            {data.hospitalization_course_summary}
          </p>
        </div>
      )}

      {/* Discharge Condition */}
      {data.condition_at_discharge && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><i className="fas fa-person-walking-arrow-right text-blue-500"></i> 出院情况</div>
          <p className="bg-white p-2 rounded border border-slate-100 leading-relaxed text-slate-600">
            {data.condition_at_discharge}
          </p>
        </div>
      )}

      {/* Discharge Orders (Meds) */}
      {data.discharge_instructions?.medications && data.discharge_instructions.medications.length > 0 && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><i className="fas fa-pills text-blue-500"></i> 出院带药</div>
          <div className="bg-white rounded border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px]">
                <tr>
                  <th className="p-2 font-normal">药品</th>
                  <th className="p-2 font-normal">用法</th>
                  <th className="p-2 font-normal">总量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.discharge_instructions.medications.map((m, i) => (
                  <tr key={i}>
                    <td className="p-2 font-medium text-slate-700">
                      {m.med_name}
                      {m.notes && <div className="text-[10px] text-slate-400 font-normal">{m.notes}</div>}
                    </td>
                    <td className="p-2 text-slate-500">{m.frequency} {m.route}</td>
                    <td className="p-2 text-slate-500">{m.dosage} x {m.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advice */}
      <div className="space-y-2">
        {data.discharge_instructions?.lifestyle_recommendations && data.discharge_instructions.lifestyle_recommendations.length > 0 && (
          <div className="bg-yellow-50 p-2.5 rounded text-yellow-800 border border-yellow-100 text-[10px]">
            <div className="font-bold mb-1"><i className="fas fa-triangle-exclamation mr-1"></i>医嘱/生活建议</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {data.discharge_instructions.lifestyle_recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {data.discharge_instructions?.follow_up_appointments && data.discharge_instructions.follow_up_appointments.length > 0 && (
          <div className="bg-blue-50 p-2.5 rounded text-blue-800 border border-blue-100 flex gap-2">
            <i className="fas fa-calendar-check mt-0.5"></i>
            <div>
              <div className="font-bold mb-1">复诊建议</div>
              {data.discharge_instructions.follow_up_appointments.map((f, i) => (
                <div key={i}>{f.date_or_interval} - {f.department} {f.notes}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Generic OCR Data Display Component
const GenericOCRDisplay = ({ data }: { data: OCRData }) => {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs border border-slate-100 shadow-inner grid grid-cols-2 gap-2">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex flex-col bg-white p-2 rounded border border-slate-50">
          <span className="text-slate-400 uppercase scale-90 origin-left mb-0.5">{k}</span>
          <span className="font-bold text-slate-700 truncate" title={String(v)}>{String(v)}</span>
        </div>
      ))}
    </div>
  )
}

// Image Previewer Component
const ImagePreview = ({ attachment }: { attachment: Attachment }) => {
  const [scale, setScale] = useState(1);
  const [signedUrl, setSignedUrl] = useState('');

  useEffect(() => {
    let active = true;
    if (attachment.ossKey) {
      getSignedUrl(attachment.ossKey)
        .then(url => { if (active) setSignedUrl(url); })
        .catch(() => { if (active) setSignedUrl(''); });
    }
    return () => { active = false; };
  }, [attachment.ossKey]);

  const src = signedUrl || attachment.url || (attachment.base64 ? `data:${attachment.type};base64,${attachment.base64}` : '');

  return (
    <div className="relative w-full h-full flex flex-col bg-black/95">
      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
        <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="text-white hover:scale-110 transition"><i className="fas fa-minus"></i></button>
        <span className="text-white font-mono text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="text-white hover:scale-110 transition"><i className="fas fa-plus"></i></button>
        <div className="w-px h-4 bg-white/20 mx-2"></div>
        <button onClick={() => setScale(1)} className="text-xs text-white/70 hover:text-white uppercase font-bold tracking-wider">Reset</button>
      </div>

      {/* Scroll Container */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <img
          src={src}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease-out' }}
          className="max-w-full max-h-full object-contain"
          alt={attachment.name}
        />
      </div>
    </div>
  )
}

// Auth Component
const AuthScreen = ({ onLogin }: { onLogin: (name: string, gender: string) => void }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('先生');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    setError('');

    if (code.trim() !== 'ant') {
      setError('邀请码无效，请重试');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!name.trim()) {
      setError('请输入您的姓名');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    onLogin(name, gender);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-50">
      <div className={`glass-panel max-w-sm w-full p-8 rounded-[32px] flex flex-col items-center shadow-2xl transition-transform ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>

        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-6 overflow-hidden">
          <img src="https://gw.alipayobjects.com/mdn/rms/afts/img/A*BAhDQLCn3-wAAAAAAAAAAAAAARQnAQ" alt="Logo" className="w-full h-full object-cover" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">SmartClaim AI</h1>
        <p className="text-sm text-slate-500 mb-8 font-medium">蚂蚁数科｜保险科技</p>

        {/* Form */}
        <div className="w-full space-y-4">

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1">邀请码</label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 focus:bg-white focus:border-blue-400 outline-none text-transparent caret-blue-500 transition-all font-medium text-center relative z-0"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                {code ? (
                  <span className="text-xl tracking-widest filter drop-shadow-sm">
                    {Array.from(code).map(() => '😊').join('')}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">请输入邀请码</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1">姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="您的称呼"
              className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 focus:bg-white focus:border-blue-400 outline-none text-slate-700 transition-all font-medium placeholder-slate-400 text-center"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {['先生', '女士'].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${gender === g ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30' : 'bg-white/40 border-white/40 text-slate-500 hover:bg-white/60'}`}
              >
                {g}
              </button>
            ))}
          </div>

          {error && (
            <div className="text-red-500 text-xs font-bold text-center mt-2 flex items-center justify-center gap-1 animate-enter">
              <i className="fas fa-circle-exclamation"></i> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full py-4 mt-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-transform hover:shadow-2xl hover:shadow-blue-500/30"
          >
            进入体验 <i className="fas fa-arrow-right ml-2 text-sm"></i>
          </button>
        </div>
      </div>

      {/* Styles for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export const App: React.FC = () => {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [userGender, setUserGender] = useState('');

  // --- State ---
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是 **SmartClaim AI**。✨\n\n请告诉我您遇到了什么问题，或者点击下方按钮快速开始。',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showReportingForm, setShowReportingForm] = useState(false);
  const [selectedDetailClaim, setSelectedDetailClaim] = useState<HistoricalClaim | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    active: number;
    currentFile?: string;
  }>({ total: 0, completed: 0, failed: 0, active: 0 });
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [fileInspectData, setFileInspectData] = useState<Attachment[] | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [expandedDocIndex, setExpandedDocIndex] = useState<number | null>(null);
  const [showUploadGuide, setShowUploadGuide] = useState(false);

  // Policy Selection State
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);
  const [isClaimsExpanded, setIsClaimsExpanded] = useState(false);

  // Claim Selection State
  const [claimSearchTerm, setClaimSearchTerm] = useState('');

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Form State
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('车辆理赔');
  const [isRecordingForm, setIsRecordingForm] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const policyUploadRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);

  const [claimState, setClaimState] = useState<ClaimState>(() => {
    let initialHistory = MOCK_HISTORICAL_CLAIMS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) initialHistory = JSON.parse(saved);
    } catch {
      initialHistory = MOCK_HISTORICAL_CLAIMS;
    }
    return {
      status: ClaimStatus.REPORTING,
      reportInfo: {},
      requiredDocs: [],
      documents: [],
      historicalClaims: initialHistory
    };
  });

  // --- Effects ---
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(claimState.historicalClaims));
    } catch {
      null;
    }
  }, [claimState.historicalClaims]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Location access denied", err)
      );
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isAnalyzing, isLoading]);

  useEffect(() => {
    // Reset expansion when modal closes
    if (!fileInspectData) {
      setExpandedDocIndex(null);
    }
  }, [fileInspectData]);

  const handleViewAttachments = (attachments: Attachment[], context: string) => {
    setFileInspectData(attachments);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: '查看材料',
      userName,
      userGender,
      inputData: {
        context,
        count: attachments.length,
        names: attachments.slice(0, 5).map(item => item.name)
      }
    });
  };

  const handlePreviewAttachment = (attachment: Attachment, context: string) => {
    setPreviewAttachment(attachment);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: '预览材料',
      userName,
      userGender,
      inputData: {
        context,
        name: attachment.name,
        type: attachment.type
      }
    });
  };

  const handleResetChat = () => {
    setMessages([]);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: '重置对话',
      userName,
      userGender
    });
  };

  const handleTogglePolicyExpand = (nextExpanded: boolean, total: number) => {
    setIsPolicyExpanded(nextExpanded);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: nextExpanded ? '展开保单列表' : '收起保单列表',
      userName,
      userGender,
      inputData: { total }
    });
  };

  const handleToggleClaimsExpand = (nextExpanded: boolean, total: number) => {
    setIsClaimsExpanded(nextExpanded);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: nextExpanded ? '展开案件列表' : '收起案件列表',
      userName,
      userGender,
      inputData: { total }
    });
  };

  const handleOpenUploadGuide = () => {
    setShowUploadGuide(true);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '打开上传指引',
      userName,
      userGender
    });
  };

  const handleCloseUploadGuide = () => {
    setShowUploadGuide(false);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '关闭上传指引',
      userName,
      userGender
    });
  };

  const handleUploadGuideChooseFile = () => {
    setShowUploadGuide(false);
    fileInputRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '上传指引选择文件',
      userName,
      userGender
    });
  };

  const handlePolicyUploadClick = () => {
    policyUploadRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '选择上传保单',
      userName,
      userGender
    });
  };

  const handleReplaceFileClick = () => {
    fileInputRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '更换文件',
      userName,
      userGender
    });
  };

  const handleCloseFileInspect = () => {
    setFileInspectData(null);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: '关闭文件列表',
      userName,
      userGender
    });
  };

  const handleClosePreview = () => {
    setPreviewAttachment(null);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: '关闭材料预览',
      userName,
      userGender
    });
  };

  const handleOpenReportingForm = () => {
    setShowReportingForm(true);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: '打开报案表单',
      userName,
      userGender
    });
  };

  const handleCloseReportingForm = () => {
    setShowReportingForm(false);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: '关闭报案表单',
      userName,
      userGender
    });
  };

  const handleCloseClaimDetail = () => {
    setSelectedDetailClaim(null);
    logUserOperation({
      operationType: UserOperationType.VIEW_CLAIM_DETAIL,
      operationLabel: '关闭案件详情',
      userName,
      userGender
    });
  };

  // --- Handlers ---

  const handleLogin = (name: string, gender: string) => {
    setUserName(name);
    setUserGender(gender);
    setIsAuthenticated(true);

    // Update the welcome message with user name
    setMessages(prev => [{
      ...prev[0],
      content: `您好，**${name}${gender}**！我是 **SmartClaim AI**。✨\n\n请告诉我您遇到了什么问题，或者点击下方按钮快速开始。`
    }]);

    logUserOperation({
      operationType: UserOperationType.LOGIN,
      operationLabel: '索赔人登录',
      userName: name,
      userGender: gender
    });
  };

  const handleDocumentClick = (doc: ClaimDocument) => {
    const attachment: Attachment = {
      name: doc.name,
      type: doc.type,
      base64: doc.base64 || '',
      url: doc.url,
      ossKey: doc.ossKey,
      analysis: doc.analysis || {
        category: doc.category || '未分类',
        isRelevant: true,
        relevanceReasoning: '历史记录',
        clarityScore: 0,
        completenessScore: 0,
        summary: '历史归档文件',
        missingFields: [],
        ocr: doc.ocrData || {},
        medicalData: doc.medicalData,
        dischargeSummaryData: doc.dischargeSummaryData
      }
    };
    setFileInspectData([attachment]);
    setExpandedDocIndex(0);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: '查看历史材料',
      userName,
      userGender,
      inputData: { name: attachment.name, type: attachment.type }
    });
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    const messagePreview = textToSend.slice(0, 200);
    const operationStart = Date.now();
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Mock specific flows for demo
    if (textToSend.includes('报案') && claimState.status === ClaimStatus.REPORTING) {
      setTimeout(() => {
        // Reset policy selection state
        setPolicySearchTerm('');
        setIsPolicyExpanded(false);

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `为您找到 ${MOCK_POLICIES.length} 份有效保单。请选择：`,
          timestamp: Date.now(),
          policySelection: true,
          policies: MOCK_POLICIES
        }]);
        setIsLoading(false);
      }, 600);
      logUserOperation({
        operationType: UserOperationType.REPORT_CLAIM,
        operationLabel: '发起报案',
        userName,
        userGender,
        inputData: { message: messagePreview, messageLength: textToSend.length },
        outputData: { policyCount: MOCK_POLICIES.length },
        duration: Date.now() - operationStart
      });
      return;
    }

    if (textToSend.includes('进度') || textToSend.includes('记录')) {
      setTimeout(() => {
        setIsClaimsExpanded(false);
        setClaimSearchTerm(''); // Reset search term
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `这是您的理赔记录：`,
          timestamp: Date.now(),
          claimsList: claimState.historicalClaims
        }]);
        setIsLoading(false);
      }, 600);
      logUserOperation({
        operationType: UserOperationType.VIEW_PROGRESS,
        operationLabel: '查看理赔进度',
        userName,
        userGender,
        inputData: { message: messagePreview, messageLength: textToSend.length },
        outputData: { claimCount: claimState.historicalClaims.length },
        duration: Date.now() - operationStart
      });
      return;
    }

    try {
      const { text, groundingLinks, aiLog } = await getAIResponse(
        messages.concat(userMsg).map(m => ({ role: m.role, content: m.content })),
        claimState,
        userLocation
      );

      // Inject car insurance checklist image if applicable
      let responseAttachments: Attachment[] | undefined;
      if (textToSend.includes('车') || textToSend.includes('机动车')) {
        responseAttachments = [{
          name: '车险理赔材料清单',
          type: 'image/jpeg',
          url: 'https://pic1.imgdb.cn/item/693fab0b4a4e4213d0058351.jpg'
        }];
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
        groundingLinks,
        attachments: responseAttachments
      }]);
      logUserOperation({
        operationType: UserOperationType.SEND_MESSAGE,
        operationLabel: '发送消息',
        userName,
        userGender,
        inputData: { message: messagePreview, messageLength: textToSend.length },
        outputData: { responseLength: text.length, groundingLinkCount: groundingLinks?.length || 0 },
        aiInteractions: aiLog ? [aiLog] : undefined,
        duration: Date.now() - operationStart
      });
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "网络连接似乎有些问题，请稍后再试。", timestamp: Date.now() }]);
      logUserOperation({
        operationType: UserOperationType.SEND_MESSAGE,
        operationLabel: '发送消息',
        userName,
        userGender,
        inputData: { message: messagePreview, messageLength: textToSend.length },
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        duration: Date.now() - operationStart
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (files: FileList | File[], source: 'file' | 'camera' | 'policy' = 'file') => {
    setIsLoading(true);
    const uploadStart = Date.now();
    const fileArray = Array.from(files);
    const limitedFiles = fileArray.slice(0, MAX_FILES_PER_UPLOAD);
    if (fileArray.length > MAX_FILES_PER_UPLOAD) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `单次最多处理 ${MAX_FILES_PER_UPLOAD} 份文件，已自动取前 ${MAX_FILES_PER_UPLOAD} 份。`,
        timestamp: Date.now()
      }]);
    }
    if (limitedFiles.length === 0) {
      setIsLoading(false);
      return;
    }

    const fileReadPromises = limitedFiles.map((file) =>
      file.type.startsWith('image/') ? createImageAttachment(file) : createFileAttachment(file)
    );

    const newAttachments = await Promise.all(fileReadPromises);

    // 2. Add User Message with thumbnails immediately
    const userMsg: Message = {
      id: `upload-${Date.now()}`,
      role: 'user',
      content: newAttachments.length > 1 ? `已上传 ${newAttachments.length} 份文件` : `上传文件`,
      timestamp: Date.now(),
      attachments: newAttachments
    };
    setMessages(prev => [...prev, userMsg]);

    setUploadProgress({ total: newAttachments.length, completed: 0, failed: 0, active: 0 });
    setIsAnalyzing('准备批量分析...');

    let completedCount = 0;
    let failedCount = 0;
    const aiLogs: AIInteractionLog[] = [];

    const results: Array<Attachment & { status: 'success' | 'failed'; error?: string }> = new Array(newAttachments.length);
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
        setIsAnalyzing(att.name);
        try {
          const analysisResult = await quickAnalyze(att.base64!, att.type);
          aiLogs.push(analysisResult.aiLog);
          const mappedAnalysis = {
            category: analysisResult.category || '未知类型',
            isRelevant: true,
            relevanceReasoning: '快速识别',
            clarityScore: 0,
            completenessScore: 0,
            summary: '快速识别结果',
            missingFields: [],
            ocr: {}
          };
          completedCount++;
          setUploadProgress(prev => ({
            ...prev,
            completed: completedCount,
            currentFile: undefined,
            active: Math.max(0, prev.active - 1)
          }));
          results[current] = { ...att, analysis: mappedAnalysis, status: 'success', url: analysisResult.ossUrl || att.url, ossKey: analysisResult.ossKey || att.ossKey };
        } catch (err) {
          console.error(`Analysis failed for ${att.name}:`, err);
          failedCount++;
          setUploadProgress(prev => ({
            ...prev,
            failed: failedCount,
            currentFile: undefined,
            active: Math.max(0, prev.active - 1)
          }));
          results[current] = { ...att, status: 'failed', error: String(err) };
        }
      }
    };
    const workerCount = Math.min(MAX_CONCURRENT_ANALYSIS, newAttachments.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const analyzedAttachments = results.filter(Boolean);
    const cleanedAttachments = analyzedAttachments.map(att => {
      if (att.type.includes('pdf')) return att;
      // Only clear base64 if we have a valid URL for preview
      if (att.type.includes('image') && att.url) return { ...att, base64: undefined };
      // Keep base64 if no URL is available (needed for preview)
      return att;
    });

    setIsAnalyzing(null);
    setPendingFiles(cleanedAttachments);

    // 4. Update User Message to show analysis is done (optional visual update)
    setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, attachments: cleanedAttachments } : m));

    // 5. Generate Summary String for Assistant Message
    const categoryCounts = cleanedAttachments.reduce((acc, curr) => {
      const cat = curr.analysis?.category || '未知类型';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryStr = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat} x${count}`)
      .join('，');

    // Check for errors to adjust message tone
    const hasErrors = cleanedAttachments.some(hasMissingFields);
    const contentPrefix = hasErrors ? `⚠️ 发现 ${cleanedAttachments.length} 份文件，但部分文件缺失关键信息，请检查：` : `✅ 已完成 ${cleanedAttachments.length} 份文件的智能识别 (${summaryStr})，详情如下：`;

    // 6. Create Assistant Message with Aggregated Results (Single Card + List Modal)
    setMessages(prev => [...prev, {
      id: `analysis-${Date.now()}`,
      role: 'assistant',
      content: contentPrefix,
      timestamp: Date.now(),
      analysisResults: cleanedAttachments,
      intentChoice: !hasErrors // Only show intent choices if no errors
    }]);

    // Reset upload progress after completion
    setUploadProgress({ total: 0, completed: 0, failed: 0, active: 0 });

    setIsLoading(false);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '上传材料',
      userName,
      userGender,
      inputData: {
        source,
        totalFiles: fileArray.length,
        limitedFiles: limitedFiles.length,
        fileTypes: Array.from(new Set(limitedFiles.map(file => file.type)))
      },
      outputData: {
        successCount: completedCount,
        failedCount,
        categories: categoryCounts
      },
      aiInteractions: aiLogs.length > 0 ? aiLogs : undefined,
      duration: Date.now() - uploadStart,
      success: failedCount === 0
    });
  };

  const handlePolicyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, 'policy');
    }
    if (policyUploadRef.current) policyUploadRef.current.value = '';
  }

  const handleClaimClick = (claim: HistoricalClaim) => {
    if (pendingFiles.length > 0) {
      const attachStart = Date.now();
      const newDocs: ClaimDocument[] = pendingFiles.map((file, index) => ({
        id: `DOC-${Date.now()}-${index}`,
        name: file.name,
        type: file.type,
        status: 'pending',
        base64: file.base64,
        url: file.url,
        ossKey: file.ossKey,
        category: file.analysis?.category || '未分类',
        ocrData: file.analysis?.ocr,
        medicalData: file.analysis?.medicalData,
        dischargeSummaryData: file.analysis?.dischargeSummaryData,
        missingFields: file.analysis?.missingFields,
        analysis: file.analysis
      }));

      const updatedClaims = (claimState.historicalClaims || []).map(c => {
        if (c.id === claim.id) {
          return {
            ...c,
            documents: [...(c.documents || []), ...newDocs],
            status: c.status === ClaimStatus.REPORTING ? ClaimStatus.DOCUMENTING : c.status
          };
        }
        return c;
      });

      setClaimState(prev => ({
        ...prev,
        historicalClaims: updatedClaims
      }));

      setPendingFiles([]);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 已将 **${newDocs.length}** 份新材料关联至案件 **${claim.id}**。`,
        timestamp: Date.now()
      }]);

      const updatedClaim = updatedClaims.find(c => c.id === claim.id);
      if (updatedClaim) {
        setSelectedDetailClaim(updatedClaim);
      }
      logUserOperation({
        operationType: UserOperationType.SUBMIT_FORM,
        operationLabel: '关联材料至案件',
        userName,
        userGender,
        claimId: claim.id,
        inputData: { attachCount: newDocs.length },
        outputData: { claimId: claim.id },
        duration: Date.now() - attachStart
      });
    } else {
      setSelectedDetailClaim(claim);
      logUserOperation({
        operationType: UserOperationType.VIEW_CLAIM_DETAIL,
        operationLabel: '查看案件详情',
        userName,
        userGender,
        claimId: claim.id
      });
    }
  };

  // Camera & Voice Functions
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, 'file');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCamera = async () => {
    const cameraStart = Date.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);
      logUserOperation({
        operationType: UserOperationType.UPLOAD_FILE,
        operationLabel: '打开相机',
        userName,
        userGender,
        duration: Date.now() - cameraStart
      });
    } catch (err) {
      console.error(err);
      logUserOperation({
        operationType: UserOperationType.UPLOAD_FILE,
        operationLabel: '打开相机失败',
        userName,
        userGender,
        success: false,
        errorMessage: String(err)
      });
    }
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    setIsCameraOpen(false);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: '关闭相机',
      userName,
      userGender
    });
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    closeCamera();
    processFiles([new File([decode(base64)], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })], 'camera');
  };

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      liveSessionRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      setIsVoiceMode(false);
      logUserOperation({
        operationType: UserOperationType.LIVE_AUDIO_SESSION,
        operationLabel: '结束语音会话',
        userName,
        userGender
      });
    } else {
      const voiceStart = Date.now();
      try {
        setIsVoiceMode(true);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        outputAudioContextRef.current = outputCtx;

        const sessionPromise = connectLive({
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session: any) => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: any) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
            }
          },
          onerror: () => setIsVoiceMode(false),
          onclose: () => setIsVoiceMode(false)
        });
        liveSessionRef.current = await sessionPromise;
        logUserOperation({
          operationType: UserOperationType.LIVE_AUDIO_SESSION,
          operationLabel: '开始语音会话',
          userName,
          userGender,
          duration: Date.now() - voiceStart
        });
      } catch (err) {
        setIsVoiceMode(false);
        logUserOperation({
          operationType: UserOperationType.LIVE_AUDIO_SESSION,
          operationLabel: '开始语音会话失败',
          userName,
          userGender,
          success: false,
          errorMessage: String(err)
        });
      }
    }
  };

  const handlePolicySelect = (policy: Policy) => {
    setClaimState(prev => ({ ...prev, selectedPolicyId: policy.id }));

    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `已选保单: ${policy.type}`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // 2. Add Assistant Message with Choice
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `收到，已为您锁定保单 **${policy.type}** (${policy.id})。✅\n\n为了更准确地记录事故信息，您可以选择以下方式继续：`,
        timestamp: Date.now() + 1,
        reportingChoice: true
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
    }, 600);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: '选择保单',
      userName,
      userGender,
      inputData: { policyId: policy.id, policyType: policy.type }
    });
  };

  const handleIntentChoice = (choice: 'new' | 'supplement') => {
    if (choice === 'new') handleSend('我要新报案');
    else setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: '请选择关联的案件：', timestamp: Date.now(), claimsList: claimState.historicalClaims }]);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: '选择报案方式',
      userName,
      userGender,
      inputData: { choice }
    });
  };

  const handleFormSubmit = () => {
    const reportStart = Date.now();
    const newClaimId = 'CLM' + Date.now().toString().slice(-6);

    // Map pending files if any
    const initialDocs: ClaimDocument[] = pendingFiles.map((file, index) => ({
      id: `DOC-${Date.now()}-${index}`,
      name: file.name,
      type: file.type,
      status: 'pending',
      base64: file.base64,
      url: file.url,
      category: file.analysis?.category || '未分类',
      ocrData: file.analysis?.ocr,
      medicalData: file.analysis?.medicalData,
      dischargeSummaryData: file.analysis?.dischargeSummaryData,
      missingFields: file.analysis?.missingFields,
      analysis: file.analysis
    }));

    setClaimState(prev => ({
      ...prev,
      historicalClaims: [{
        id: newClaimId, date: new Date().toISOString().split('T')[0], type: formType, status: ClaimStatus.DOCUMENTING,
        incidentReason: formDescription, documents: initialDocs, timeline: []
      }, ...(prev.historicalClaims || [])]
    }));

    setPendingFiles([]); // Clear pending
    setShowReportingForm(false);
    handleSend('立案已提交');
    logUserOperation({
      operationType: UserOperationType.REPORT_CLAIM,
      operationLabel: '提交报案',
      userName,
      userGender,
      claimId: newClaimId,
      inputData: {
        formType,
        descriptionLength: formDescription.trim().length,
        pendingFileCount: pendingFiles.length
      },
      outputData: { claimId: newClaimId },
      duration: Date.now() - reportStart
    });
  };

  // --- Render ---

  // Show Auth Screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen relative bg-transparent font-sans">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 z-20 shrink-0 bg-white/30 backdrop-blur-md border-b border-white/50 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
            <img src="https://gw.alipayobjects.com/mdn/rms/afts/img/A*BAhDQLCn3-wAAAAAAAAAAAAAARQnAQ" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">SmartClaim</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide">蚂蚁数科｜保险科技</span>
            </div>
          </div>
        </div>
        <button onClick={handleResetChat} className="w-10 h-10 rounded-full glass-btn flex items-center justify-center text-slate-600">
          <i className="fas fa-rotate-right"></i>
        </button>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth pb-36">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-enter`}>

              <div className={`p-4 max-w-[85%] sm:max-w-[75%] ${msg.role === 'assistant' ? 'msg-bubble-ai' : 'msg-bubble-user'}`}>
                <div className="prose-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>

                {/* User Attachments Grid (Thumbnails & Filenames) - Max 5 Items Logic */}
                {msg.attachments && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {/* Render first 4 items normally */}
                    {msg.attachments.slice(0, 4).map((att, i) => (
                      <div key={i} className="flex flex-col gap-1 items-center cursor-pointer group" onClick={() => handleViewAttachments(msg.attachments!, '消息附件')}>
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/10 border border-white/20 group-hover:shadow-md transition-all">
                          {att.type.includes('image') && (att.base64 || att.url) ? <img src={att.url || `data:${att.type};base64,${att.base64}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className={`fas ${getDocIcon(att.name)} text-xl opacity-50`}></i></div>}
                        </div>
                        <div className="text-[10px] text-center w-full truncate opacity-70 px-0.5 leading-tight">{att.name}</div>
                      </div>
                    ))}

                    {/* If exactly 5 items, render the 5th one normally */}
                    {msg.attachments.length === 5 && (
                      <div className="flex flex-col gap-1 items-center cursor-pointer group" onClick={() => handleViewAttachments(msg.attachments!, '消息附件')}>
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/10 border border-white/20 group-hover:shadow-md transition-all">
                          {msg.attachments[4].type.includes('image') && (msg.attachments[4].base64 || msg.attachments[4].url) ? <img src={msg.attachments[4].url || `data:${msg.attachments[4].type};base64,${msg.attachments[4].base64}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className={`fas ${getDocIcon(msg.attachments[4].name)} text-xl opacity-50`}></i></div>}
                        </div>
                        <div className="text-[10px] text-center w-full truncate opacity-70 px-0.5 leading-tight">{msg.attachments[4].name}</div>
                      </div>
                    )}

                    {/* If more than 5 items, render the +N button in the 5th slot */}
                    {msg.attachments.length > 5 && (
                      <div className="flex flex-col gap-1 items-center cursor-pointer group" onClick={() => handleViewAttachments(msg.attachments!, '消息附件')}>
                        <div className="relative w-full aspect-square rounded-lg bg-white/20 border border-white/30 group-hover:bg-white/30 transition-all flex items-center justify-center text-white font-bold text-xs shadow-inner">
                          +{msg.attachments.length - 4}
                        </div>
                        <div className="text-[10px] text-center w-full truncate opacity-70 px-0.5 leading-tight">更多...</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Assistant Analysis Result (Single Card + Expand) */}
                {msg.analysisResults && msg.analysisResults.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {/* Only show the FIRST result as a card, with error styling if needed */}
                    {(() => {
                      const firstDoc = msg.analysisResults[0];
                      const isError = hasMissingFields(firstDoc);
                      const imgSrc = firstDoc.url || (firstDoc.base64 ? `data:${firstDoc.type};base64,${firstDoc.base64}` : '');

                      return (
                        <div
                          className={`p-3 rounded-xl border flex items-center gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${isError ? 'bg-red-50 border-red-200' : 'bg-white/60 border-white/60'}`}
                          onClick={() => handleViewAttachments(msg.analysisResults!, '分析结果')}
                        >
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0 overflow-hidden border ${isError ? 'bg-red-100 border-red-200 text-red-500' : 'bg-blue-50 border-blue-100 text-blue-500'}`}>
                            {firstDoc.type.includes('image') && imgSrc ? <img src={imgSrc} className="w-full h-full object-cover" /> : <i className={`fas ${getDocIcon(firstDoc.name)}`}></i>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-700 truncate">{firstDoc.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {isError ? (
                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs font-bold flex items-center gap-1 truncate">
                                  <i className="fas fa-triangle-exclamation"></i> 缺少: {firstDoc.analysis?.missingFields?.join('、')}
                                </span>
                              ) : (
                                <>
                                  <span className="text-[10px] bg-blue-100/50 text-blue-600 px-1.5 py-0.5 rounded text-xs font-medium">
                                    {firstDoc.analysis?.category || '识别中'}
                                  </span>
                                  {firstDoc.analysis?.ocr?.amount && (
                                    <span className="text-[10px] text-slate-500">¥{firstDoc.analysis.ocr.amount}</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm ${isError ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white'}`}>
                            <i className={`fas ${isError ? 'fa-exclamation' : 'fa-check'}`}></i>
                          </div>
                        </div>
                      );
                    })()}

                    {/* View All Button if > 1 result */}
                    {msg.analysisResults.length > 1 && (
                      <button onClick={() => handleViewAttachments(msg.analysisResults!, '分析结果')} className="w-full py-2.5 bg-white/40 hover:bg-white/60 rounded-lg text-xs font-bold text-slate-600 transition-colors border border-white/40 flex items-center justify-center gap-2">
                        查看全部 {msg.analysisResults.length} 个结果 <i className="fas fa-chevron-right text-[10px]"></i>
                      </button>
                    )}
                  </div>
                )}

                {/* Grounding Links */}
                {msg.groundingLinks && (
                  <div className="mt-3 pt-3 border-t border-dashed border-current/20 flex flex-wrap gap-2">
                    {msg.groundingLinks.map((link, i) => (
                      <a key={i} href={link.uri} target="_blank" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors no-underline text-current">
                        <i className="fas fa-link text-[10px]"></i> {link.title || 'Source'}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Interactive Elements (Below Bubble) */}
              <div className="mt-2 w-full max-w-[85%] sm:max-w-[75%]">
                {msg.reportingChoice && (
                  <div className="flex gap-2">
                    <button onClick={toggleVoiceMode} className="glass-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                      <i className="fas fa-microphone text-blue-500"></i> 语音报案
                    </button>
                    <button onClick={handleOpenReportingForm} className="glass-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                      <i className="fas fa-pen-to-square text-cyan-500"></i> 在线填单
                    </button>
                  </div>
                )}

                {msg.intentChoice && (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleIntentChoice('new')} className="glass-btn w-full py-3 rounded-xl text-sm font-bold text-left px-4">🆕 发起新理赔</button>
                    <button onClick={() => handleIntentChoice('supplement')} className="glass-btn w-full py-3 rounded-xl text-sm font-bold text-left px-4">📎 补充至旧案</button>
                  </div>
                )}

                {msg.policies && (
                  <div className="bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                    {/* Search Bar */}
                    <div className="relative mb-3">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        placeholder="搜索保单号或险种..."
                        className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 outline-none focus:border-blue-400 transition-colors"
                        value={policySearchTerm}
                        onChange={(e) => setPolicySearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const filteredPolicies = msg.policies.filter(p =>
                          p.type.includes(policySearchTerm) ||
                          p.id.toLowerCase().includes(policySearchTerm.toLowerCase()) ||
                          p.insuredName.includes(policySearchTerm)
                        );

                        const visiblePolicies = isPolicyExpanded ? filteredPolicies : filteredPolicies.slice(0, 3);

                        return (
                          <>
                            {visiblePolicies.map(p => {
                              const now = new Date();
                              const validUntil = new Date(p.validUntil);
                              const isExpired = validUntil < now;

                              return (
                                <Card
                                  key={p.id}
                                  onClick={() => handlePolicySelect(p)}
                                  className={`relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${isExpired ? 'bg-slate-50' : ''}`}
                                >
                                  <div className="relative z-10">
                                    {/* Header: ID + Status */}
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className="text-[10px] font-mono text-slate-400">{p.id}</span>
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExpired ? 'bg-slate-200 text-slate-500' : 'bg-green-100 text-green-600'}`}>
                                        {isExpired ? '已失效' : '保障中'}
                                      </span>
                                    </div>

                                    {/* Main Title */}
                                    <div className="font-bold text-slate-700 text-sm mb-2">{p.type}</div>

                                    {/* Details: Insured + Date */}
                                    <div className="flex flex-col gap-0.5 text-xs text-slate-500 border-t border-slate-100 pt-2">
                                      <div className="flex justify-between">
                                        <span>被保人</span>
                                        <span className="font-medium text-slate-700">{p.insuredName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>有效期至</span>
                                        <span className={isExpired ? 'text-red-400' : 'text-slate-600'}>{p.validUntil}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Stamp Effect for Expired */}
                                  {isExpired && (
                                    <div className="absolute -right-2 -bottom-2 w-20 h-20 border-4 border-slate-300 rounded-full flex items-center justify-center opacity-20 -rotate-12 pointer-events-none">
                                      <div className="w-16 h-16 border-2 border-slate-300 rounded-full flex items-center justify-center">
                                        <span className="text-slate-400 font-black text-xs transform -rotate-0">已过期</span>
                                      </div>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}

                            {/* Empty State */}
                            {filteredPolicies.length === 0 && (
                              <div className="text-center py-4 text-slate-400 text-xs italic">
                                未找到匹配的保单
                              </div>
                            )}

                            {/* Actions Footer */}
                            <div className="flex gap-2 pt-1">
                              {/* Expand Toggle */}
                              {filteredPolicies.length > 3 && (
                                <button
                                  onClick={() => handleTogglePolicyExpand(!isPolicyExpanded, filteredPolicies.length)}
                                  className="flex-1 py-2 rounded-lg bg-white/60 hover:bg-white text-xs text-slate-600 font-bold border border-slate-100 transition-colors"
                                >
                                  {isPolicyExpanded ? '收起' : `查看全部 (${filteredPolicies.length})`}
                                </button>
                              )}

                              {/* Upload Button */}
                              <button
                                onClick={handlePolicyUploadClick}
                                className="flex-1 py-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-xs text-blue-600 font-bold flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <i className="fas fa-file-arrow-up"></i> 上传保单 PDF
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {msg.claimsList && (
                  <div className="bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                    {/* Search Bar */}
                    <div className="relative mb-3">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        placeholder="搜索案件号、险种或原因..."
                        className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 outline-none focus:border-blue-400 transition-colors"
                        value={claimSearchTerm}
                        onChange={(e) => setClaimSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const filteredClaims = msg.claimsList.filter(c =>
                          c.id.toLowerCase().includes(claimSearchTerm.toLowerCase()) ||
                          c.type.includes(claimSearchTerm) ||
                          (c.incidentReason && c.incidentReason.includes(claimSearchTerm))
                        );

                        const visibleClaims = isClaimsExpanded ? filteredClaims : filteredClaims.slice(0, 3);
                        return (
                          <>
                            {visibleClaims.map((c, i) => (
                              <Card key={i} onClick={() => handleClaimClick(c)}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-slate-700 text-sm">{c.type}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === ClaimStatus.PAID ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{getStatusLabel(c.status)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
                                  <span className="text-[10px] text-slate-400">{c.date}</span>
                                </div>

                                {c.incidentReason && (
                                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-2">
                                    <span className="font-bold text-slate-400 mr-1"><i className="fas fa-circle-info"></i></span>
                                    {c.incidentReason}
                                  </div>
                                )}

                                {pendingFiles.length > 0 && (
                                  <div className="mt-2 text-xs bg-blue-50 text-blue-600 p-1.5 rounded text-center border border-blue-100 font-bold">
                                    <i className="fas fa-file-import mr-1"></i> 点击关联当前文件
                                  </div>
                                )}
                              </Card>
                            ))}

                            {filteredClaims.length === 0 && (
                              <div className="text-center py-4 text-slate-400 text-xs italic">
                                未找到匹配的案件
                              </div>
                            )}

                            {filteredClaims.length > 3 && (
                              <button
                                onClick={() => handleToggleClaimsExpand(!isClaimsExpanded, filteredClaims.length)}
                                className="w-full py-2 rounded-lg bg-white/60 hover:bg-white text-xs text-slate-600 font-bold border border-slate-100 transition-colors flex items-center justify-center gap-1"
                              >
                                {isClaimsExpanded ? '收起' : `查看更多历史案件 (${filteredClaims.length - 3})`}
                                <i className={`fas fa-chevron-${isClaimsExpanded ? 'up' : 'down'}`}></i>
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex items-center gap-3 animate-pulse text-slate-500 text-sm ml-2">
              <i className="fas fa-circle-notch fa-spin text-blue-500"></i>
              正在分析文件: <span className="font-bold">{isAnalyzing}</span>...
            </div>
          )}
          {isLoading && !isAnalyzing && (
            <div className="flex gap-1 ml-4">
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-100"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-200"></div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Input Dock */}
      <div className="absolute bottom-0 left-0 w-full z-30 p-4 bg-gradient-to-t from-white/80 to-transparent pointer-events-none flex flex-col items-center">
        <div className="w-full max-w-2xl pointer-events-auto space-y-3">
          {uploadProgress.total > 0 && (
            <div className="p-4 bg-white/90 backdrop-blur-sm rounded-xl border border-blue-200 shadow-lg">
              <div className="flex justify-between text-sm text-gray-600 mb-3">
                <span className="font-medium">
                  处理进度: {uploadProgress.completed} / {uploadProgress.total}
                </span>
                <span className={uploadProgress.failed > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                  {uploadProgress.failed > 0 && `失败: ${uploadProgress.failed}`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                />
              </div>
              {(uploadProgress.currentFile || uploadProgress.active > 0) && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8 018 0 18 018 0-018-8 018-8 018 0z"></path>
                  </svg>
                  {(uploadProgress.currentFile ? `正在处理: ${uploadProgress.currentFile}` : '正在处理...') + (uploadProgress.active > 0 ? ` · 并行处理中: ${uploadProgress.active}` : '')}
                </p>
              )}
            </div>
          )}

          {/* Quick Actions (Scrollable) */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => handleSend("我要报案")} className="glass-btn shrink-0 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
              <i className="fas fa-truck-medical text-red-500"></i> 我要报案
            </button>
            <button onClick={() => handleSend("进度查询")} className="glass-btn shrink-0 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
              <i className="fas fa-list-check text-blue-500"></i> 进度查询
            </button>
            <button onClick={toggleVoiceMode} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${isVoiceMode ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'glass-btn'}`}>
              <i className="fas fa-microphone"></i> {isVoiceMode ? '挂断语音' : '语音管家'}
            </button>
          </div>

          {/* Input Bar */}
          <div className="input-dock p-2 flex items-center gap-2">
            <button onClick={handleOpenUploadGuide} className="w-10 h-10 rounded-full hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors">
              <i className="fas fa-paperclip text-lg"></i>
            </button>
            <button onClick={openCamera} className="w-10 h-10 rounded-full hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors">
              <i className="fas fa-camera text-lg"></i>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入消息..."
              className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 font-medium h-10"
            />
            <button onClick={() => handleSend()} disabled={!input.trim()} className="w-10 h-10 rounded-full primary-btn flex items-center justify-center disabled:opacity-50 disabled:shadow-none">
              <i className="fas fa-arrow-up"></i>
            </button>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
      <input ref={policyUploadRef} type="file" accept=".pdf" className="hidden" onChange={handlePolicyUpload} />

      {/* --- Overlays --- */}

      {/* Upload Guide Modal */}
      {showUploadGuide && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-enter" onClick={handleCloseUploadGuide}>
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-white/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="fas fa-cloud-arrow-up"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-800">上传材料指引</h3>
                <p className="text-xs text-slate-500">SmartClaim AI 智能识别</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <i className="fas fa-robot mt-1 text-blue-500"></i>
                <p className="leading-relaxed text-xs">文件上传后，系统将自动进行 <strong>OCR 识别</strong>，提取关键字段（如金额、日期、诊断）并归档。</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fas fa-check text-green-500"></i>
                  <span>支持格式：JPG, PNG, PDF</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fas fa-check text-green-500"></i>
                  <span>大小限制：单文件不超过 10MB</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fas fa-triangle-exclamation text-yellow-500"></i>
                  <span>请确保图片光线充足，文字清晰可辨</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleUploadGuideChooseFile}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus"></i> 选择文件
            </button>
          </div>
        </div>
      )}

      {/* Reporting Form Modal */}
      {showReportingForm && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-enter" onClick={handleCloseReportingForm}>
          <div className="glass-panel w-full max-w-md p-6 rounded-[32px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">在线报案</h3>
              <button onClick={handleCloseReportingForm} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><i className="fas fa-xmark"></i></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 ml-1">险种类型</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 outline-none text-slate-700 font-medium appearance-none"
                >
                  <option>车辆理赔</option>
                  <option>医疗理赔</option>
                  <option>财产理赔</option>
                  <option>意外理赔</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 ml-1">事故描述</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="请简要描述事故经过..."
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 outline-none text-slate-700 h-32 resize-none"
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleFormSubmit}
                  disabled={!formDescription.trim()}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:shadow-none"
                >
                  提交报案
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera */}
      {isCameraOpen && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col">
          <div className="relative flex-1 bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            <button onClick={closeCamera} className="absolute top-6 right-6 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center"><i className="fas fa-xmark"></i></button>
          </div>
          <div className="h-32 bg-black flex items-center justify-center gap-8">
            <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"><div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform"></div></button>
          </div>
        </div>
      )}

      {/* Voice Mode */}
      {isVoiceMode && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl z-40 flex flex-col items-center justify-center animate-enter">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
            <div className="w-32 h-32 bg-gradient-to-tr from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-4xl shadow-2xl">
              <i className="fas fa-microphone"></i>
            </div>
          </div>
          <h3 className="mt-8 text-2xl font-bold text-slate-800">正在聆听...</h3>
          <p className="text-slate-500 mt-2">请直接描述您的事故情况</p>
          <button onClick={toggleVoiceMode} className="mt-12 w-16 h-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xl hover:bg-red-200 transition-colors">
            <i className="fas fa-phone-slash"></i>
          </button>
        </div>
      )}

      {/* Detail View */}
      {selectedDetailClaim && (
        <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg max-h-[85vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-enter">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
              <h2 className="text-xl font-bold text-slate-800">案件详情</h2>
              <button onClick={handleCloseClaimDetail} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"><i className="fas fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
              {/* Status Section */}
              <div className="p-5 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 shadow-sm">
                <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Current Status</div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-slate-800">{getStatusLabel(selectedDetailClaim.status)}</span>
                  <span className="text-2xl text-blue-500">
                    <i className={`fas ${selectedDetailClaim.status === ClaimStatus.PAID ? 'fa-circle-check' :
                      selectedDetailClaim.status === ClaimStatus.REJECTED ? 'fa-circle-xmark' : 'fa-spinner fa-spin'
                      }`}></i>
                  </span>
                </div>
                {selectedDetailClaim.assessment && (
                  <div className="text-sm text-slate-600 bg-white/60 p-3 rounded-lg border border-blue-50/50">
                    {selectedDetailClaim.assessment.reasoning}
                  </div>
                )}
              </div>

              {/* Timeline Section */}
              {selectedDetailClaim.timeline && selectedDetailClaim.timeline.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i className="fas fa-clock-rotate-left"></i> 理赔进度
                  </h4>
                  <div className="relative pl-2">
                    {/* Vertical Connector Line */}
                    <div className="absolute left-[7px] top-2 bottom-4 w-0.5 bg-slate-100"></div>

                    <div className="space-y-6">
                      {selectedDetailClaim.timeline.map((event, idx) => (
                        <div key={idx} className="relative flex gap-4 group">
                          <div className={`w-4 h-4 rounded-full mt-1 shrink-0 z-10 ring-4 ring-white transition-all duration-500 ${event.status === 'completed' ? 'bg-blue-500 shadow-lg shadow-blue-500/30' :
                            event.status === 'active' ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/30' :
                              'bg-slate-200'
                            }`}></div>
                          <div className={`${event.status === 'pending' ? 'opacity-50' : 'opacity-100'}`}>
                            <div className="text-[10px] font-bold text-slate-400 font-mono tracking-wide mb-0.5 uppercase">{event.date}</div>
                            <div className={`text-sm font-bold mb-1 ${event.status === 'active' ? 'text-green-600' : 'text-slate-700'}`}>{event.label}</div>
                            <div className="text-xs text-slate-500 leading-relaxed max-w-[280px]">{event.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <i className="fas fa-folder-open"></i> 关联材料
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDetailClaim.documents?.map((d, i) => (
                    <div
                      key={i}
                      onClick={() => handleDocumentClick(d)}
                      className="p-3 bg-white rounded-xl border border-slate-100 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer active:scale-95"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0"><i className={`fas ${getDocIcon(d.name)}`}></i></div>
                      <div className="overflow-hidden min-w-0">
                        <div className="text-sm font-bold text-slate-700 truncate">{d.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <i className="fas fa-check-circle text-green-500 text-[10px]"></i> 已验证
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!selectedDetailClaim.documents?.length) && <div className="text-sm text-slate-400 italic py-4 text-center w-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">暂无关联文件</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Inspector Modal (List View) */}
      {fileInspectData && (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-enter">
          <div className="w-full sm:max-w-lg bg-white h-[90vh] sm:h-auto sm:max-h-[80vh] sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">文件详情 ({fileInspectData.length})</h3>
              <button onClick={handleCloseFileInspect} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"><i className="fas fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {fileInspectData.map((doc, i) => {
                const isError = hasMissingFields(doc);
                const imgSrc = doc.url || (doc.base64 ? `data:${doc.type};base64,${doc.base64}` : '');
                return (
                  <div key={i} className={`p-4 rounded-xl shadow-sm border flex gap-4 animate-enter ${isError ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`} style={{ animationDelay: `${i * 50}ms` }}>
                    <div
                      className="w-20 h-20 rounded-lg bg-slate-100 shrink-0 overflow-hidden border border-slate-100 relative group cursor-pointer"
                      onClick={() => handlePreviewAttachment(doc, '文件列表')}
                    >
                      {doc.type.includes('image') && imgSrc ? (
                        <img src={imgSrc} className={`w-full h-full object-cover transition-transform group-hover:scale-110 ${isError ? 'opacity-80' : ''}`} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl"><i className={`fas ${getDocIcon(doc.name)}`}></i></div>
                      )}

                      {/* Zoom Hint Overlay */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <i className="fas fa-magnifying-glass-plus text-white text-lg"></i>
                      </div>

                      {isError && (
                        <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center pointer-events-none">
                          <i className="fas fa-triangle-exclamation text-red-500 text-2xl drop-shadow-sm"></i>
                        </div>
                      )}
                    </div>
                    <div
                      className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer"
                      onClick={() => setExpandedDocIndex(expandedDocIndex === i ? null : i)}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-800 text-sm truncate mb-1">{doc.name}</h4>
                        {isError && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplaceFileClick();
                            }}
                            className="text-[10px] bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded-full font-bold transition-colors"
                          >
                            更换文件
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {isError ? (
                          <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-md font-bold border border-red-200 flex items-center gap-1">
                            <i className="fas fa-times-circle"></i> 缺失信息: {doc.analysis?.missingFields?.join('、')}
                          </span>
                        ) : (
                          <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-md font-semibold border border-blue-100">
                            {doc.analysis?.category || '分析中...'}
                          </span>
                        )}

                        {!isError && doc.analysis?.clarityScore && (
                          <span className="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded-md border border-green-100">
                            清晰度 {doc.analysis.clarityScore}%
                          </span>
                        )}
                      </div>
                      {doc.analysis?.summary && (
                        <p className={`text-xs line-clamp-2 leading-relaxed p-2 rounded-lg ${isError ? 'text-red-500 bg-red-100/50' : 'text-slate-500 bg-slate-50'}`}>
                          {doc.analysis.summary}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-1 text-blue-500 text-xs font-bold select-none">
                        {expandedDocIndex === i ? '收起详情' : '查看识别详情'}
                        <i className={`fas fa-chevron-${expandedDocIndex === i ? 'up' : 'down'} transition-transform`}></i>
                      </div>

                      {expandedDocIndex === i && doc.analysis && (
                        <div onClick={e => e.stopPropagation()} className="cursor-auto animate-enter origin-top">
                          {doc.analysis.medicalData ? (
                            <MedicalDataDisplay data={doc.analysis.medicalData} />
                          ) : doc.analysis.dischargeSummaryData ? (
                            <DischargeSummaryDisplay data={doc.analysis.dischargeSummaryData} />
                          ) : (
                            <GenericOCRDisplay data={doc.analysis.ocr} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-100 bg-white">
              <button onClick={handleCloseFileInspect} className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (Full Screen) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[200] flex flex-col animate-enter">
          {/* Top Bar */}
          <div className="h-16 bg-black/95 text-white flex items-center justify-between px-6 border-b border-white/10 shrink-0">
            <h3 className="font-bold truncate max-w-md">{previewAttachment.name}</h3>
            <button onClick={handleClosePreview} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <i className="fas fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-black/90 relative overflow-hidden">
            {previewAttachment.type.includes('image') && (previewAttachment.base64 || previewAttachment.url) ? (
              <ImagePreview attachment={previewAttachment} />
            ) : previewAttachment.type.includes('pdf') && previewAttachment.base64 ? (
              <iframe
                src={`data:application/pdf;base64,${previewAttachment.base64}`}
                className="w-full h-full bg-white"
                title={previewAttachment.name}
              ></iframe>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 flex-col gap-4">
                <i className="fas fa-file-circle-question text-6xl"></i>
                <p>无法预览此文件类型或文件内容未加载</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
