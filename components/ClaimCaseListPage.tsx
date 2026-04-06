import React, { useState, useMemo, useEffect } from "react";
import { type ClaimCase, ClaimStatus } from "../types";
import Pagination from "./ui/Pagination";
import Select from "./ui/Select";
import Input from "./ui/Input";
import { api } from "../services/api";

// 状态图标组件
const StatusIcon: React.FC<{ status: ClaimStatus }> = ({ status }) => {
  switch (status) {
    case ClaimStatus.REPORTED:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case ClaimStatus.PROCESSING:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    case ClaimStatus.APPROVED:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case ClaimStatus.REJECTED:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case ClaimStatus.PENDING_INFO:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
};

function getImportTaskBadge(taskStatus: string | null) {
  switch (taskStatus) {
    case "processing":
    case "pending":
    case "archived":
      return {
        label: "导入中",
        className: "bg-blue-50 text-blue-700 border-blue-100",
      };
    case "failed":
    case "partial_success":
      return {
        label: "可恢复",
        className: "bg-amber-50 text-amber-700 border-amber-100",
      };
    case "completed":
      return {
        label: "已完成",
        className: "bg-green-50 text-green-700 border-green-100",
      };
    case null:
    case undefined:
      return {
        label: "未导入",
        className: "bg-gray-50 text-gray-400 border-gray-100",
      };
    default:
      return {
        label: `未知(${taskStatus})`,
        className: "bg-yellow-50 text-yellow-700 border-yellow-100",
      };
  }
}

interface ClaimCaseListPageProps {
  onViewDetail: (claim: ClaimCase) => void;
}

const ClaimCaseListPage: React.FC<ClaimCaseListPageProps> = ({
  onViewDetail,
}) => {
  const [cases, setCases] = useState<ClaimCase[]>([]);
  const [latestImportMap, setLatestImportMap] = useState<
    Record<
      string,
      {
        taskId: string | null;
        taskStatus: string | null;
        importedAt: string | null;
        failureHint?: string | null;
      }
    >
  >({});
  const [recoveringTaskId, setRecoveringTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const data = await api.claimCases.list();
        setCases(data as ClaimCase[]);

        const importResponse = await fetch("/api/claim-documents");
        if (importResponse.ok) {
          const importRecords = await importResponse.json();
          const nextMap: Record<
            string,
            {
              taskId: string | null;
              taskStatus: string | null;
              importedAt: string | null;
            }
          > = {};

          for (const record of Array.isArray(importRecords)
            ? importRecords
            : []) {
            if (!record?.claimCaseId) continue;
            const importedAt = record.importedAt || null;
            const current = nextMap[record.claimCaseId];
            if (
              !current ||
              new Date(importedAt || 0).getTime() >
                new Date(current.importedAt || 0).getTime()
            ) {
              nextMap[record.claimCaseId] = {
                taskId: record.taskId || null,
                taskStatus: record.taskStatus || null,
                importedAt,
                failureHint: record.failureHint || null,
              };
            }
          }

          setLatestImportMap(nextMap);
        }
      } catch (error) {
        console.error("Failed to fetch claim cases:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const handleRecoverTask = async (
    claimCaseId: string,
    taskId: string | null,
  ) => {
    if (!taskId || recoveringTaskId) return;

    setRecoveringTaskId(taskId);
    try {
      const response = await fetch("/api/offline-import/recover-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "恢复任务失败");
      }

      setLatestImportMap((prev) => ({
        ...prev,
        [claimCaseId]: {
          taskId,
          taskStatus: result.status || "completed",
          importedAt: prev[claimCaseId]?.importedAt || null,
        },
      }));
    } catch (error) {
      console.error("Recover task failed:", error);
      alert(error instanceof Error ? error.message : "恢复任务失败");
    } finally {
      setRecoveringTaskId(null);
    }
  };

  // Filter States
  const [reportNumber, setReportNumber] = useState("");
  const [reporter, setReporter] = useState("");
  const [reportDateStart, setReportDateStart] = useState("");
  const [reportDateEnd, setReportDateEnd] = useState("");
  const [accidentDateStart, setAccidentDateStart] = useState("");
  const [accidentDateEnd, setAccidentDateEnd] = useState("");
  const [status, setStatus] = useState<string>("");

  // Active Filters (for search button)
  const [activeFilters, setActiveFilters] = useState({
    reportNumber: "",
    reporter: "",
    reportDateStart: "",
    reportDateEnd: "",
    accidentDateStart: "",
    accidentDateEnd: "",
    status: "",
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const total = cases.length;
    const reported = cases.filter(
      (c) => c.status === ClaimStatus.REPORTED,
    ).length;
    const processing = cases.filter(
      (c) => c.status === ClaimStatus.PROCESSING,
    ).length;
    const approved = cases.filter(
      (c) => c.status === ClaimStatus.APPROVED,
    ).length;
    const totalAmount = cases.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
    return { total, reported, processing, approved, totalAmount };
  }, [cases]);

  const handleSearch = () => {
    setActiveFilters({
      reportNumber,
      reporter,
      reportDateStart,
      reportDateEnd,
      accidentDateStart,
      accidentDateEnd,
      status,
    });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setReportNumber("");
    setReporter("");
    setReportDateStart("");
    setReportDateEnd("");
    setAccidentDateStart("");
    setAccidentDateEnd("");
    setStatus("");
    setActiveFilters({
      reportNumber: "",
      reporter: "",
      reportDateStart: "",
      reportDateEnd: "",
      accidentDateStart: "",
      accidentDateEnd: "",
      status: "",
    });
    setCurrentPage(1);
  };

  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => {
        // Quick filter
        if (quickFilter !== "all") {
          if (
            quickFilter === "pending" &&
            c.status !== ClaimStatus.REPORTED &&
            c.status !== ClaimStatus.PENDING_INFO
          )
            return false;
          if (
            quickFilter === "processing" &&
            c.status !== ClaimStatus.PROCESSING
          )
            return false;
          if (
            quickFilter === "completed" &&
            c.status !== ClaimStatus.APPROVED &&
            c.status !== ClaimStatus.REJECTED
          )
            return false;
        }

        const matchReportNum =
          !activeFilters.reportNumber ||
          c.reportNumber
            .toLowerCase()
            .includes(activeFilters.reportNumber.toLowerCase());
        const matchReporter =
          !activeFilters.reporter ||
          c.reporter
            .toLowerCase()
            .includes(activeFilters.reporter.toLowerCase());
        const matchStatus =
          !activeFilters.status || c.status === activeFilters.status;

        const cReportDate = (c.reportTime || "").split(" ")[0] || "";
        const matchReportDate =
          (!activeFilters.reportDateStart ||
            cReportDate >= activeFilters.reportDateStart) &&
          (!activeFilters.reportDateEnd ||
            cReportDate <= activeFilters.reportDateEnd);

        const cAccidentDate = (c.accidentTime || "").split(" ")[0] || "";
        const matchAccidentDate =
          (!activeFilters.accidentDateStart ||
            cAccidentDate >= activeFilters.accidentDateStart) &&
          (!activeFilters.accidentDateEnd ||
            cAccidentDate <= activeFilters.accidentDateEnd);

        return (
          matchReportNum &&
          matchReporter &&
          matchStatus &&
          matchReportDate &&
          matchAccidentDate
        );
      })
      .sort((a, b) => {
        // Sort by reportTime in descending order (newest first)
        return (
          new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime()
        );
      });
  }, [cases, activeFilters, quickFilter]);

  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCases, currentPage]);

  const totalPages = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);

  const getStatusStyle = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.REPORTED:
        return "bg-blue-50 text-blue-700 border-blue-100";
      case ClaimStatus.PROCESSING:
        return "bg-yellow-50 text-yellow-700 border-yellow-100";
      case ClaimStatus.PENDING_INFO:
        return "bg-orange-50 text-orange-700 border-orange-100";
      case ClaimStatus.APPROVED:
        return "bg-green-50 text-green-700 border-green-100";
      case ClaimStatus.REJECTED:
        return "bg-red-50 text-red-700 border-red-100";
      case ClaimStatus.CANCELLED:
        return "bg-gray-50 text-gray-500 border-gray-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <div className="text-gray-500 text-sm">加载赔案数据中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">赔案管理</h1>
          <p className="text-gray-500 text-sm mt-1">
            管理和处理所有保险理赔案件
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition">
            <svg
              className="w-4 h-4 mr-2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            导出报表
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">全部案件</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">待处理</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.reported}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">处理中</p>
              <p className="text-2xl font-bold text-amber-600">
                {stats.processing}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">累计索赔额</p>
              <p className="text-2xl font-bold text-green-600">
                ￥{(stats.totalAmount / 10000).toFixed(1)}万
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filters + Advanced Filter Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: "all", label: "全部", count: stats.total },
              { key: "pending", label: "待处理", count: stats.reported },
              { key: "processing", label: "处理中", count: stats.processing },
              { key: "completed", label: "已完结", count: stats.approved },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setQuickFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  quickFilter === tab.key
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                    quickFilter === tab.key
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Toggle Advanced Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            高级筛选
            <svg
              className={`w-4 h-4 ml-1 transition-transform ${showFilters ? "rotate-180" : ""}`}
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
          </button>
        </div>

        {/* Advanced Filters (Collapsible) */}
        {showFilters && (
          <div className="px-6 py-5 bg-gray-50/50 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="报案号"
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                placeholder="请输入报案号"
              />
              <Input
                label="报案人"
                value={reporter}
                onChange={(e) => setReporter(e.target.value)}
                placeholder="请输入报案人姓名"
              />
              <Select
                label="案件状态"
                value={status}
                onChange={setStatus}
                options={Object.values(ClaimStatus).map((s) => ({
                  label: s,
                  value: s,
                }))}
                placeholder="请选择状态"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  报案时间范围
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={reportDateStart}
                    onChange={(e) => setReportDateStart(e.target.value)}
                    className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={reportDateEnd}
                    onChange={(e) => setReportDateEnd(e.target.value)}
                    className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  事故时间范围
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={accidentDateStart}
                    onChange={(e) => setAccidentDateStart(e.target.value)}
                    className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={accidentDateEnd}
                    onChange={(e) => setAccidentDateEnd(e.target.value)}
                    className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="lg:col-span-2 flex items-end justify-end space-x-3">
                <button
                  onClick={handleReset}
                  className="h-9 px-5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                >
                  重置
                </button>
                <button
                  onClick={handleSearch}
                  className="h-9 px-5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition"
                >
                  查询
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  报案信息
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  事故时间
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  事故原因
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  索赔金额
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  保险产品
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCases.length > 0 ? (
                paginatedCases.map((c) => {
                  const importMeta = latestImportMap[c.id];
                  const importBadge = getImportTaskBadge(
                    importMeta?.taskStatus || null,
                  );
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-4">
                            {c.reporter.charAt(0)}
                          </div>
                          <div>
                            <p
                              className="text-sm font-semibold text-indigo-600 cursor-pointer hover:underline"
                              onClick={() => onViewDetail(c)}
                            >
                              {c.reportNumber}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {c.reporter} · {c.reportTime.split(" ")[0]}
                            </p>
                            {importMeta?.taskId && (
                              <div className="mt-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${importBadge.className}`}
                                >
                                  {importBadge.label}
                                </span>
                                {importMeta.failureHint &&
                                  ["failed", "partial_success"].includes(
                                    importMeta.taskStatus || "",
                                  ) && (
                                    <p
                                      className="text-[10px] text-amber-700 mt-1 max-w-[260px] truncate"
                                      title={importMeta.failureHint}
                                    >
                                      {importMeta.failureHint}
                                    </p>
                                  )}
                              </div>
                            )}
                            {c.id && c.id.startsWith("CLM") && (
                              <p className="text-xs text-orange-600 mt-0.5 font-medium">
                                前端编号: {c.id}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-gray-900">
                          {c.accidentTime.split(" ")[0]}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.accidentTime.split(" ")[1] || ""}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <p
                          className="text-sm text-gray-600 max-w-[200px] truncate"
                          title={c.accidentReason}
                        >
                          {c.accidentReason}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          ¥{(c.claimAmount ?? 0).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                          {c.productName}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${getStatusStyle(c.status)}`}
                        >
                          <StatusIcon status={c.status} />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {importMeta?.taskId && (
                            <button
                              onClick={() =>
                                handleRecoverTask(
                                  c.id,
                                  importMeta?.taskId || null,
                                )
                              }
                              disabled={recoveringTaskId === importMeta?.taskId}
                              className={`p-2 rounded-lg transition ${
                                recoveringTaskId === importMeta?.taskId
                                  ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                                  : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                              }`}
                              title="恢复导入任务"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </button>
                          )}
                          {c.status === ClaimStatus.PENDING_INFO && (
                            <button
                              onClick={() => onViewDetail(c)}
                              className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition"
                              title="补传材料并重新审核"
                            >
                              补件
                            </button>
                          )}
                          <button
                            onClick={() => onViewDetail(c)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="查看详情"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => onViewDetail(c)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="处理案件"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <svg
                        className="w-16 h-16 text-gray-200 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-gray-500 font-medium">
                        暂无符合条件的赔案数据
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        试试调整筛选条件
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredCases.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
};

export default ClaimCaseListPage;
