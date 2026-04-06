import React, { useState, useEffect, Suspense, lazy } from "react";
import ProductListPage from "./components/ProductListPage";
import ProductConfigPage from "./components/ProductConfigPage";
import ClauseManagementPage from "./components/ClauseManagementPage";
import AddClausePage from "./components/AddClausePage";
import ViewClausePage from "./components/ViewClausePage";
import AddProductPage from "./components/AddProductPage";
import StrategyManagementPage from "./components/StrategyManagementPage";
import SystemSettingsPage from "./components/SystemSettingsPage";
import LoginPage from "./components/LoginPage";
import EditStrategyPage from "./components/EditStrategyPage";
import CompanyManagementPage from "./components/CompanyManagementPage";
import AddCompanyPage from "./components/AddCompanyPage";
import ViewCompanyPage from "./components/ViewCompanyPage";
import EditCompanyPage from "./components/EditCompanyPage";
import IndustryDataListPage from "./components/IndustryDataListPage";
import EditIndustryDataPage from "./components/EditIndustryDataPage";
import SmartAdvisorConfigPage from "./components/SmartAdvisorConfigPage";
import InsuranceTypeManagementPage from "./components/InsuranceTypeManagementPage";
import UserListPage from "./components/UserListPage";
import DataDashboardPage from "./components/DataDashboardPage";
import ResponsibilityManagementPage from "./components/ResponsibilityManagementPage";
import ClaimsMaterialManagementPage from "./components/ClaimsMaterialManagementPage";
import FactCatalogManagementPage from "./components/FactCatalogManagementPage";
import MaterialValidationRulesPage from "./components/MaterialValidationRulesPage";
import ClaimItemConfigPage from "./components/ClaimItemConfigPage";
import ClaimIntakeConfigPage from "./components/ClaimIntakeConfigPage";
import ClaimCaseListPage from "./components/ClaimCaseListPage";
import ClaimCaseDetailPage from "./components/ClaimCaseDetailPage";
import ClaimWorkbenchPage from "./components/ClaimWorkbenchPage";
import RulesetManagementPage from "./components/RulesetManagementPage";
import FormulaManagementPage from "./components/FormulaManagementPage";
import InvoiceAuditPage from "./components/InvoiceAuditPage";
import MedicalCatalogManagementPage from "./components/MedicalCatalogManagementPage";
import HospitalManagementPage from "./components/HospitalManagementPage";
import UserOperationLogsPage from "./components/UserOperationLogsPage";
import SystemLogsPage from "./SystemLogsPage";
import IntakeFieldPresetsManager from "./components/IntakeFieldPresetsManager";
import MessageCenter from "./components/MessageCenter";
import { MessageBell } from "./components/MessageBell";
import QuoteListPage from "./components/QuoteListPage";
import QuoteDetailPage from "./components/QuoteDetailPage";
import PolicyListPage from "./components/PolicyListPage";
import PolicyDetailPage from "./components/PolicyDetailPage";
import { AITestPanel } from "./services/ai/AITestPanel";
import { aiService } from "./services/ai/aiService";
import { VoiceClaimPage } from "./pages/VoiceClaimPage";
import KnowledgeManagementPage from "./components/knowledge/KnowledgeManagementPage";
import { GeminiProvider } from "./services/ai/providers/geminiProvider";
import { ClaudeProvider } from "./services/ai/providers/claudeProvider";
import {
  type Clause,
  type InsuranceProduct,
  ProductStatus,
  type DecisionTable,
  type IndustryData,
  type ClaimCase,
  type QuoteRequest,
  type InsurancePolicy,
} from "./types";

import {
  SANITIZED_MOCK_CLAUSES as MOCK_CLAUSES,
  MOCK_CLAIM_CASES,
  MOCK_RESPONSIBILITIES,
  MOCK_CLAIMS_MATERIALS,
  MOCK_CLAIM_ITEMS,
  MOCK_PRODUCT_CLAIM_CONFIGS,
  MOCK_RULESETS,
  MOCK_END_USERS,
  MOCK_COMPANY_LIST,
  MOCK_COMPANY_PROFILES,
  LEVEL_1_DATA,
  LEVEL_2_DATA,
  LEVEL_3_DATA,
  MAPPING_DATA,
} from "./constants";
import { api } from "./services/api";

const AIInteractionLogsPage = lazy(
  () => import("./components/AIInteractionLogsPage"),
);
const AIConfigCenterPage = lazy(
  () => import("./components/AIConfigCenterPage"),
);
const AIDashboardPage = lazy(() => import("./components/AIDashboardPage"));
const AIModelManagementPage = lazy(
  () => import("./components/AIModelManagementPage"),
);
const AICostAnalyticsPage = lazy(
  () => import("./components/AICostAnalyticsPage"),
);
const AIModelComparisonPage = lazy(
  () => import("./components/AIModelComparisonPage"),
);
const AIAlertPage = lazy(() => import("./components/AIAlertPage"));

// 注册 AI 提供商
aiService.registerProvider(new GeminiProvider());
aiService.registerProvider(new ClaudeProvider());

// --- Icon Components ---
const IconWrapper: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={`w-5 h-5 flex items-center justify-center ${className}`}>
    {children}
  </div>
);
const ProductMgmtIcon = () => (
  <IconWrapper className="text-gray-500">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  </IconWrapper>
);
const StrategyIcon = () => (
  <IconWrapper className="text-gray-500">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  </IconWrapper>
);
const QuoteMgmtIcon = () => (
  <IconWrapper className="text-gray-500">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  </IconWrapper>
);
const SettingsIcon = () => (
  <IconWrapper className="text-gray-500">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  </IconWrapper>
);
const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);
const ChevronUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 15.75 7.5-7.5 7.5 7.5"
    />
  </svg>
);

// --- Layout Components ---

type AppView =
  | "knowledge_management"
  | "product_list"
  | "product_config"
  | "clause_management"
  | "add_clause"
  | "view_clause"
  | "edit_clause"
  | "add_product"
  | "strategy_management"
  | "edit_strategy"
  | "system_settings"
  | "company_management"
  | "add_company"
  | "view_company"
  | "edit_company"
  | "industry_data_list"
  | "edit_industry_data"
  | "smart_advisor_config"
  | "insurance_type_management"
  | "responsibility_management"
  | "user_list"
  | "data_dashboard"
  | "claims_material_management"
  | "fact_catalog_management"
  | "material_validation_rules"
  | "claim_item_config"
  | "claim_intake_config"
  | "intake_field_presets"
  | "claim_case_list"
  | "claim_case_detail"
  | "claim_workbench"
  | "invoice_audit"
  | "medical_catalog_management"
  | "hospital_management"
  | "ruleset_management"
  | "formula_management"
  | "user_operation_logs"
  | "ai_interaction_logs"
  | "system_logs"
  | "ai_config_center"
  | "ai_dashboard"
  | "ai_model_management"
  | "ai_cost_analytics"
  | "ai_model_comparison"
  | "ai_alerts"
  | "ai_test"
  | "quote_list"
  | "quote_detail"
  | "quote_create"
  | "quote_edit"
  | "policy_list"
  | "policy_detail"
  | "policy_create"
  | "policy_edit"
  | "message_center"
  | "voice_claim";

type NavSubItemData = { name: string; id: AppView };
type NavItemData = {
  name: string;
  icon: React.ReactNode;
  children: NavSubItemData[];
};

const navItems: NavItemData[] = [
  {
    name: "智能保顾配置",
    icon: <StrategyIcon />,
    children: [
      { name: "产品列表", id: "product_list" },
      { name: "条款管理", id: "clause_management" },
      { name: "险种管理", id: "insurance_type_management" },
      { name: "责任管理", id: "responsibility_management" },
      { name: "保险公司管理", id: "company_management" },
      { name: "行业基础数据", id: "industry_data_list" },
      { name: "保险产品推荐配置", id: "strategy_management" },
      { name: "智能保顾计算元素配置", id: "smart_advisor_config" },
    ],
  },
  {
    name: "询价及保单管理",
    icon: <QuoteMgmtIcon />,
    children: [
      { name: "询价单管理", id: "quote_list" },
      { name: "保单管理", id: "policy_list" },
    ],
  },
  {
    name: "理赔管理",
    icon: <ProductMgmtIcon />,
    children: [
      { name: "理赔员工作台", id: "claim_workbench" },
      { name: "语音报案", id: "voice_claim" },
      { name: "理赔项目及材料配置", id: "claim_item_config" },
      { name: "元数据中心", id: "fact_catalog_management" },
      { name: "材料校验规则", id: "material_validation_rules" },
      { name: "报案信息配置", id: "claim_intake_config" },
      { name: "报案字段预设管理", id: "intake_field_presets" },
      { name: "赔案清单", id: "claim_case_list" },
      { name: "发票审核", id: "invoice_audit" },
      { name: "医保目录管理", id: "medical_catalog_management" },
      { name: "医院信息管理", id: "hospital_management" },
      { name: "规则集管理", id: "ruleset_management" },
      { name: "知识库管理", id: "knowledge_management" },
    ],
  },
  {
    name: "AI 管理",
    icon: <SettingsIcon />,
    children: [
      { name: "总览驾驶舱", id: "ai_dashboard" },
      { name: "模型与供应商管理", id: "ai_model_management" },
      { name: "能力与模板中心", id: "ai_config_center" },
      { name: "调用审计中心", id: "ai_interaction_logs" },
      { name: "成本与业务分析", id: "ai_cost_analytics" },
      { name: "模型运行对比", id: "ai_model_comparison" },
      { name: "AI 告警中心", id: "ai_alerts" },
    ],
  },
  {
    name: "系统管理",
    icon: <SettingsIcon />,
    children: [
      { name: "用户清单", id: "user_list" },
      { name: "数据看板", id: "data_dashboard" },
      { name: "用户操作日志", id: "user_operation_logs" },
      { name: "系统日志", id: "system_logs" },
      { name: "账号设置", id: "system_settings" },
      { name: "AI 测试", id: "ai_test" },
    ],
  },
];

const activeParentViews: Record<string, AppView[]> = {
  智能保顾配置: [
    "product_list",
    "product_config",
    "add_product",
    "clause_management",
    "add_clause",
    "view_clause",
    "edit_clause",
    "company_management",
    "add_company",
    "view_company",
    "edit_company",
    "industry_data_list",
    "edit_industry_data",
    "insurance_type_management",
    "responsibility_management",
    "strategy_management",
    "edit_strategy",
    "smart_advisor_config",
  ],
  询价及保单管理: [
    "quote_list",
    "quote_detail",
    "quote_create",
    "quote_edit",
    "policy_list",
    "policy_detail",
    "policy_create",
    "policy_edit",
  ],
  理赔管理: [
    "claim_workbench",
    "voice_claim",
    "claim_item_config",
    "fact_catalog_management",
    "material_validation_rules",
    "claim_intake_config",
    "intake_field_presets",
    "claim_case_list",
    "claim_case_detail",
    "invoice_audit",
    "medical_catalog_management",
    "hospital_management",
    "ruleset_management",
  ],
  "AI 管理": [
    "ai_dashboard",
    "ai_model_management",
    "ai_config_center",
    "ai_interaction_logs",
    "ai_cost_analytics",
    "ai_model_comparison",
    "ai_alerts",
  ],
  系统管理: [
    "system_settings",
    "user_list",
    "data_dashboard",
    "user_operation_logs",
    "system_logs",
    "ai_test",
    "formula_management",
  ],
};

const Sidebar: React.FC<{
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}> = ({ currentView, onViewChange }) => {
  const [openGroup, setOpenGroup] = useState<string>("智能保顾配置");

  const toggleGroup = (name: string) => {
    setOpenGroup((prev) => (prev === name ? "" : name));
  };

  return (
    <aside className="w-56 flex-shrink-0 bg-gradient-to-b from-slate-50 to-slate-100 p-2 flex flex-col border-r border-slate-200">
      <div className="flex items-center h-16 px-4">
        <img
          src="https://mdn.alipayobjects.com/huamei_wbchdc/afts/img/A*2yRxQIapKMwAAAAAAAAAAAAADkOZAQ/original"
          alt="AntChain Logo"
          className="h-8"
        />
        <span className="text-slate-800 text-lg font-bold ml-3">保险科技</span>
      </div>
      <nav className="flex-1 space-y-1 mt-2">
        {navItems.map((item) => {
          const isParentActive =
            activeParentViews[item.name]?.includes(currentView);
          const isOpen = openGroup === item.name;

          return (
            <div key={item.name}>
              <button
                onClick={() => toggleGroup(item.name)}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isParentActive ? "text-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <div className="flex items-center">
                  {item.icon}
                  <span className="ml-3 font-semibold">{item.name}</span>
                </div>
                <span className={`transform transition-transform`}>
                  {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </span>
              </button>
              {isOpen && (
                <div className="pl-4 mt-1 space-y-1">
                  {item.children.map((child) => {
                    let isActive = false;
                    if (child.id === "product_list") {
                      isActive = [
                        "product_list",
                        "product_config",
                        "add_product",
                      ].includes(currentView);
                    } else if (child.id === "clause_management") {
                      isActive = [
                        "clause_management",
                        "add_clause",
                        "view_clause",
                        "edit_clause",
                      ].includes(currentView);
                    } else if (child.id === "strategy_management") {
                      isActive = [
                        "strategy_management",
                        "edit_strategy",
                      ].includes(currentView);
                    } else if (child.id === "company_management") {
                      isActive = [
                        "company_management",
                        "add_company",
                        "view_company",
                        "edit_company",
                      ].includes(currentView);
                    } else if (child.id === "industry_data_list") {
                      isActive = [
                        "industry_data_list",
                        "edit_industry_data",
                      ].includes(currentView);
                    } else if (child.id === "quote_list") {
                      isActive = [
                        "quote_list",
                        "quote_detail",
                        "quote_create",
                        "quote_edit",
                      ].includes(currentView);
                    } else if (child.id === "policy_list") {
                      isActive = [
                        "policy_list",
                        "policy_detail",
                        "policy_create",
                        "policy_edit",
                      ].includes(currentView);
                    } else {
                      isActive = currentView === child.id;
                    }

                    return (
                      <button
                        key={child.id}
                        onClick={() => onViewChange(child.id)}
                        className={`w-full text-left pl-7 pr-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-[#f0f2f5] font-semibold text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {child.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

const Header: React.FC<{
  onLogout: () => void;
  onMessageClick: () => void;
}> = ({ onLogout, onMessageClick }) => (
  <header className="bg-transparent h-16 px-6 flex items-center justify-end">
    <div className="flex items-center space-x-5">
      <MessageBell />
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
          <img src="https://i.pravatar.cc/40?u=test" alt="User Avatar" />
        </div>
        <span className="text-sm font-medium text-gray-700">麦礼</span>
      </div>
    </div>
  </header>
);

// --- Main App Component ---

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    companyCode?: string;
    tool?: "智能体" | "省心配";
  } | null>(null);
  const [view, setView] = useState<AppView>("product_list");
  const [currentProduct, setCurrentProduct] = useState<InsuranceProduct | null>(
    null,
  );
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [selectedStrategy, setSelectedStrategy] =
    useState<DecisionTable | null>(null);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string | null>(
    null,
  );
  const [selectedIndustryData, setSelectedIndustryData] =
    useState<IndustryData | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimCase | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(
    null,
  );

  // Auto-seed: on first run, if backend has no data, persist MOCK data to JSON files
  useEffect(() => {
    const seedIfEmpty = async (
      apiResource: {
        list: () => Promise<any[]>;
        saveAll: (data: any[]) => Promise<any>;
      },
      mockData: any[],
    ) => {
      try {
        const data = await apiResource.list();
        if (data && data.length > 0) return data;
        if (mockData && mockData.length > 0) {
          await apiResource.saveAll(mockData);
          return mockData;
        }
        return data;
      } catch {
        return mockData || [];
      }
    };

    const initData = async () => {
      try {
        // Seed all resources in parallel
        const [productsData] = await Promise.all([
          seedIfEmpty(api.products, MOCK_CLAUSES),
          seedIfEmpty(api.clauses, MOCK_CLAUSES),
          seedIfEmpty(api.responsibilities, MOCK_RESPONSIBILITIES),
          seedIfEmpty(api.claimsMaterials, MOCK_CLAIMS_MATERIALS),
          seedIfEmpty(api.claimItems, MOCK_CLAIM_ITEMS),
          seedIfEmpty(api.claimCases, MOCK_CLAIM_CASES),
          seedIfEmpty(api.rulesets, MOCK_RULESETS),
          seedIfEmpty(api.productClaimConfigs, MOCK_PRODUCT_CLAIM_CONFIGS),
          seedIfEmpty(api.endUsers, MOCK_END_USERS),
          seedIfEmpty(api.companies, [
            ...MOCK_COMPANY_LIST,
            ...Object.values(MOCK_COMPANY_PROFILES),
          ]),
          seedIfEmpty(api.insuranceTypes, [
            ...LEVEL_1_DATA,
            ...LEVEL_2_DATA,
            ...LEVEL_3_DATA,
          ]),
          seedIfEmpty(api.mappingData, MAPPING_DATA),
        ]);
        setProducts(productsData as InsuranceProduct[]);
      } catch (error) {
        console.error("Failed to initialize data:", error);
      }
    };
    initData();
  }, []);

  const handleLogin = (user: {
    username: string;
    companyCode?: string;
    tool?: "智能体" | "省心配";
  }) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setView("product_list");
  };

  const handleSelectConfig = (product: InsuranceProduct) => {
    setCurrentProduct(product);
    setView("product_config");
  };

  const handleBackToList = () => {
    setCurrentProduct(null);
    setView("product_list");
  };

  const handleViewClause = (clause: Clause) => {
    setSelectedClause(clause);
    setView("view_clause");
  };

  const handleEditClause = (clause: Clause) => {
    setSelectedClause(clause);
    setView("edit_clause");
  };

  const handleEditStrategy = (strategy: DecisionTable) => {
    setSelectedStrategy(strategy);
    setView("edit_strategy");
  };

  const handleViewCompany = (code: string) => {
    setSelectedCompanyCode(code);
    setView("view_company");
  };

  const handleEditCompany = (code: string) => {
    setSelectedCompanyCode(code);
    setView("edit_company");
  };

  const handleEditIndustryData = (data: IndustryData) => {
    setSelectedIndustryData(data);
    setView("edit_industry_data");
  };

  const handleViewClaim = async (claim: ClaimCase) => {
    // Try to fetch the full detail from API
    try {
      const fullDetail = await api.claimCases.getById(claim.id);
      setSelectedClaim((fullDetail as ClaimCase) || claim);
    } catch {
      setSelectedClaim(claim);
    }
    setView("claim_case_detail");
  };

  const handleAddProductSave = async (product: InsuranceProduct) => {
    const operator = currentUser?.username || "系统管理员";
    const newProduct = { ...product, operator };
    try {
      await api.products.add(newProduct);
      const data = await api.products.list();
      setProducts(data);
      setView("product_list");
    } catch (error) {
      console.error("Failed to save product:", error);
      alert("保存失败");
    }
  };

  const handleEditProductSave = async (product: InsuranceProduct) => {
    const operator = currentUser?.username || "系统管理员";
    const updatedProducts = products.map((p) =>
      p.productCode === product.productCode ? { ...product, operator } : p,
    );
    try {
      await api.products.saveAll(updatedProducts);
      setProducts(updatedProducts);
      setView("product_list");
    } catch (error) {
      console.error("Failed to update product:", error);
      alert("更新失败");
    }
  };

  const handleUpdateProductStatus = async (
    productCode: string,
    status: ProductStatus,
  ) => {
    const operator = currentUser?.username || "系统管理员";
    const updatedProducts = products.map((p) =>
      p.productCode === productCode ? { ...p, status, operator } : p,
    );
    try {
      await api.products.saveAll(updatedProducts);
      setProducts(updatedProducts);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleViewChange = (newView: AppView) => {
    setView(newView);
    if (newView === "product_list") {
      setCurrentProduct(null);
    }
    if (newView === "clause_management") {
      setSelectedClause(null);
    }
    if (newView === "strategy_management") {
      setSelectedStrategy(null);
    }
    if (newView === "company_management") {
      setSelectedCompanyCode(null);
    }
    if (newView === "industry_data_list") {
      setSelectedIndustryData(null);
    }
    if (newView === "claim_case_list") {
      setSelectedClaim(null);
    }
    if (newView === "quote_list") {
      setSelectedQuote(null);
    }
    if (newView === "policy_list") {
      setSelectedPolicy(null);
    }
  };

  useEffect(() => {
    const handleExternalNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ view?: AppView }>;
      if (customEvent.detail?.view) {
        handleViewChange(customEvent.detail.view);
      }
    };

    window.addEventListener(
      "app:navigate",
      handleExternalNavigate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "app:navigate",
        handleExternalNavigate as EventListener,
      );
    };
  }, []);

  const handleViewQuote = (quote: QuoteRequest) => {
    setSelectedQuote(quote);
    setView("quote_detail");
  };

  const handleCreateQuote = () => {
    setSelectedQuote(null);
    setView("quote_create");
  };

  const renderAILazyPage = (node: React.ReactNode) => (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">AI 管理页面加载中...</div>
      }
    >
      {node}
    </Suspense>
  );

  const handleSaveQuote = async (quote: QuoteRequest) => {
    const operator = currentUser?.username || "系统管理员";
    const newQuote = { ...quote, operator };
    try {
      if (selectedQuote) {
        // Update existing
        await api.quotes.update(selectedQuote.id, newQuote);
      } else {
        // Create new
        await api.quotes.add(newQuote);
      }
      setSelectedQuote(newQuote);
      setView("quote_detail");
    } catch (error) {
      console.error("Failed to save quote:", error);
      alert("保存失败");
    }
  };

  const handleConvertQuoteToPolicy = async (quote: QuoteRequest) => {
    try {
      const result = await api.convertQuoteToPolicy(quote.id);
      alert("转保单成功！");
      setSelectedPolicy(result.policy);
      setView("policy_detail");
    } catch (error) {
      console.error("Failed to convert quote:", error);
      alert("转保单失败");
    }
  };

  const handleViewPolicy = async (policy: InsurancePolicy) => {
    setSelectedPolicy(policy);
    setView("policy_detail");
  };

  const handleViewPolicyByNumber = async (policyNumber: string) => {
    try {
      const policies = (await api.policies.list()) as InsurancePolicy[];
      const matched = policies.find((p) => p.policyNumber === policyNumber);
      if (matched) {
        setSelectedPolicy(matched);
        setView("policy_detail");
      }
    } catch (error) {
      console.error("Failed to load policy:", error);
    }
  };

  const handleCreatePolicy = () => {
    setSelectedPolicy(null);
    setView("policy_create");
  };

  const handleSavePolicy = async (policy: InsurancePolicy) => {
    const operator = currentUser?.username || "系统管理员";
    const newPolicy = { ...policy, operator };
    try {
      if (selectedPolicy) {
        await api.policies.update(selectedPolicy.id, newPolicy);
      } else {
        await api.policies.add(newPolicy);
      }
      setSelectedPolicy(newPolicy);
      setView("policy_detail");
    } catch (error) {
      console.error("Failed to save policy:", error);
      alert("保存失败");
    }
  };

  const handleInitiateClaim = (policy: InsurancePolicy) => {
    const product = products.find((p) => p.productCode === policy.productCode);

    if (!product) {
      alert(
        `未找到保单 ${policy.policyNumber} 关联的产品（${policy.productCode}），请先在保单详情中选择关联产品。`,
      );
      return;
    }

    const intakeConfig = product.intakeConfig;
    const hasConfig =
      !!intakeConfig &&
      (intakeConfig.fields.length > 0 || intakeConfig.voice_input?.enabled);

    if (!hasConfig) {
      alert(
        `产品「${product.regulatoryName}」尚未配置报案信息，请先在“报案信息及理赔材料配置”中为该产品配置报案字段/材料。`,
      );
      return;
    }

    const fieldNames =
      intakeConfig?.fields.map((f) => f.label).join("、") || "无";
    const voiceEnabled = intakeConfig?.voice_input?.enabled ? "是" : "否";
    const extraMaterialCount =
      intakeConfig?.claimMaterials?.extraMaterialIds?.length || 0;

    alert(
      `保单 ${policy.policyNumber} 发起理赔\n\n` +
        `关联产品：${product.regulatoryName}\n` +
        `报案字段（${intakeConfig?.fields.length || 0}项）：${fieldNames}\n` +
        `语音报案：${voiceEnabled}\n` +
        `额外理赔材料：${extraMaterialCount}项\n\n` +
        `（下一步：理赔创建页面/报案页接入该产品 intakeConfig）`,
    );
  };

  const renderContent = () => {
    switch (view) {
      case "product_list":
        return (
          <ProductListPage
            products={products}
            onSelectConfig={handleSelectConfig}
            onAddProduct={() => setView("add_product")}
            onUpdateStatus={handleUpdateProductStatus}
            companyCode={currentUser?.companyCode || undefined}
          />
        );
      case "product_config":
        return (
          currentProduct && (
            <ProductConfigPage
              product={currentProduct}
              onBack={handleBackToList}
              onSave={handleEditProductSave}
            />
          )
        );
      case "add_product":
        return (
          <AddProductPage
            onBack={handleBackToList}
            onSave={handleAddProductSave}
            companyCode={currentUser?.companyCode}
          />
        );
      case "clause_management":
        return (
          <ClauseManagementPage
            onAddClause={() => setView("add_clause")}
            onViewClause={handleViewClause}
            onEditClause={handleEditClause}
            companyCode={currentUser?.companyCode || undefined}
          />
        );
      case "add_clause":
        return (
          <AddClausePage
            onBack={() => setView("clause_management")}
            companyCode={currentUser?.companyCode || undefined}
          />
        );
      case "view_clause":
        return (
          selectedClause && (
            <ViewClausePage
              clause={selectedClause}
              onBack={() => {
                setView("clause_management");
                setSelectedClause(null);
              }}
            />
          )
        );
      case "edit_clause":
        return (
          selectedClause && (
            <AddClausePage
              onBack={() => {
                setView("clause_management");
                setSelectedClause(null);
              }}
              initialClause={selectedClause}
            />
          )
        );
      case "insurance_type_management":
        return <InsuranceTypeManagementPage tool={currentUser?.tool} />;
      case "strategy_management":
        return <StrategyManagementPage onEditStrategy={handleEditStrategy} />;
      case "edit_strategy":
        return (
          selectedStrategy && (
            <EditStrategyPage
              strategy={selectedStrategy}
              onBack={() => setView("strategy_management")}
            />
          )
        );
      case "company_management":
        return (
          <CompanyManagementPage
            onViewCompany={handleViewCompany}
            onAddCompany={() => setView("add_company")}
            onEditCompany={handleEditCompany}
            companyCode={currentUser?.companyCode || undefined}
          />
        );
      case "add_company":
        return <AddCompanyPage onBack={() => setView("company_management")} />;
      case "view_company":
        return (
          selectedCompanyCode && (
            <ViewCompanyPage
              companyCode={selectedCompanyCode}
              onBack={() => {
                setView("company_management");
                setSelectedCompanyCode(null);
              }}
            />
          )
        );
      case "edit_company":
        return (
          selectedCompanyCode && (
            <EditCompanyPage
              companyCode={selectedCompanyCode}
              onBack={() => {
                setView("company_management");
                setSelectedCompanyCode(null);
              }}
            />
          )
        );
      case "industry_data_list":
        return <IndustryDataListPage onEdit={handleEditIndustryData} />;
      case "edit_industry_data":
        return (
          selectedIndustryData && (
            <EditIndustryDataPage
              industryData={selectedIndustryData}
              onBack={() => {
                setView("industry_data_list");
                setSelectedIndustryData(null);
              }}
            />
          )
        );
      case "smart_advisor_config":
        return <SmartAdvisorConfigPage />;
      case "responsibility_management":
        return <ResponsibilityManagementPage />;
      case "claims_material_management":
        return <ClaimsMaterialManagementPage />;
      case "fact_catalog_management":
        return <FactCatalogManagementPage />;
      case "material_validation_rules":
        return <MaterialValidationRulesPage />;
      case "claim_item_config":
        return <ClaimItemConfigPage />;
      case "claim_intake_config":
        return (
          <ClaimIntakeConfigPage
            products={products}
            operator={currentUser?.username}
            onUpdateProducts={setProducts}
          />
        );
      case "intake_field_presets":
        return <IntakeFieldPresetsManager />;
      case "claim_case_list":
        return <ClaimCaseListPage onViewDetail={handleViewClaim} />;
      case "claim_case_detail":
        return (
          selectedClaim && (
            <ClaimCaseDetailPage
              claim={selectedClaim}
              onBack={() => setView("claim_case_list")}
              onViewPolicy={handleViewPolicyByNumber}
            />
          )
        );
      case "claim_workbench":
        return <ClaimWorkbenchPage onViewClaim={handleViewClaim} />;
      case "voice_claim":
        return <VoiceClaimPage currentUser={currentUser} />;
      case "knowledge_management":
        return <KnowledgeManagementPage onViewChange={setView} />;
      case "invoice_audit":
        return <InvoiceAuditPage />;
      case "medical_catalog_management":
        return <MedicalCatalogManagementPage />;
      case "hospital_management":
        return <HospitalManagementPage />;
      case "formula_management":
        return <FormulaManagementPage />;
      case "ruleset_management":
        return <RulesetManagementPage />;
      case "user_list":
        return <UserListPage />;
      case "data_dashboard":
        return <DataDashboardPage />;
      case "ai_dashboard":
        return renderAILazyPage(<AIDashboardPage />);
      case "ai_model_management":
        return renderAILazyPage(<AIModelManagementPage />);
      case "ai_cost_analytics":
        return renderAILazyPage(<AICostAnalyticsPage />);
      case "ai_model_comparison":
        return renderAILazyPage(<AIModelComparisonPage />);
      case "ai_alerts":
        return renderAILazyPage(<AIAlertPage />);
      case "system_settings":
        return <SystemSettingsPage currentUser={currentUser || undefined} />;
      case "ai_config_center":
        return renderAILazyPage(
          <AIConfigCenterPage currentUsername={currentUser?.username} />,
        );
      case "user_operation_logs":
        return <UserOperationLogsPage />;
      case "ai_interaction_logs":
        return renderAILazyPage(<AIInteractionLogsPage />);
      case "system_logs":
        return <SystemLogsPage />;
      case "quote_list":
        return (
          <QuoteListPage
            onViewDetail={handleViewQuote}
            onCreateQuote={handleCreateQuote}
            onConvertToPolicy={handleConvertQuoteToPolicy}
          />
        );
      case "quote_detail":
      case "quote_create":
      case "quote_edit":
        return (
          <QuoteDetailPage
            quote={selectedQuote || undefined}
            onBack={() => setView("quote_list")}
            onSave={handleSaveQuote}
          />
        );
      case "policy_list":
        return (
          <PolicyListPage
            onViewDetail={handleViewPolicy}
            onCreatePolicy={handleCreatePolicy}
            onInitiateClaim={handleInitiateClaim}
          />
        );
      case "policy_detail":
      case "policy_create":
      case "policy_edit":
        return (
          <PolicyDetailPage
            policy={selectedPolicy || undefined}
            onBack={() => setView("policy_list")}
            onSave={handleSavePolicy}
          />
        );
      case "ai_test":
        return (
          <div className="p-6">
            <div className="mb-4">
              <h1 className="text-2xl font-bold">AI 测试面板</h1>
              <p className="text-gray-600 mt-1">
                测试不同 AI 提供商的性能、成本和准确性
              </p>
            </div>
            <AITestPanel onClose={() => setView("system_settings")} />
          </div>
        );
      case "message_center":
        return <MessageCenter onOpenClaim={handleViewClaim} />;
      default:
        return (
          <ProductListPage
            products={products}
            onSelectConfig={handleSelectConfig}
            onAddProduct={() => setView("add_product")}
          />
        );
    }
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#f0f2f5] font-sans text-slate-800">
      <Sidebar currentView={view} onViewChange={handleViewChange} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-[#e6f4ff] to-[#f0f2f5] pointer-events-none" />
        <Header
          onLogout={handleLogout}
          onMessageClick={() => setView("message_center")}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent px-6 pb-6 relative">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
