/**
 * 人工复核工单服务
 *
 * 当材料识别置信度低于阈值时，自动创建工单供理赔员复核
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createIntervention,
  transitionState,
  listByClaimCase,
} from "./interventionStateMachine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../../jsonlist");
const REVIEW_TASKS_FILE = path.join(DATA_DIR, "review-tasks.json");

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REVIEW_TASKS_FILE)) {
    fs.writeFileSync(REVIEW_TASKS_FILE, JSON.stringify([], null, 2));
  }
};

const readTasks = () => {
  ensureDataFile();
  try {
    const data = fs.readFileSync(REVIEW_TASKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const writeTasks = (tasks) => {
  ensureDataFile();
  fs.writeFileSync(REVIEW_TASKS_FILE, JSON.stringify(tasks, null, 2));
};

export const reviewTaskService = {
  list: async (filters = {}) => {
    let tasks = readTasks();

    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    if (filters.claimCaseId) {
      tasks = tasks.filter((t) => t.claimCaseId === filters.claimCaseId);
    }
    if (filters.materialId) {
      tasks = tasks.filter((t) => t.materialId === filters.materialId);
    }
    if (filters.priority) {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }
    if (filters.reviewerId) {
      tasks = tasks.filter((t) => t.reviewerId === filters.reviewerId);
    }

    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return tasks;
  },

  getById: async (id) => {
    const tasks = readTasks();
    return tasks.find((t) => t.id === id) || null;
  },

  create: async (taskData) => {
    const tasks = readTasks();
    const newTask = {
      id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...taskData,
      status: taskData.status || "待处理",
      priority: taskData.priority || "中",
      createdAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    writeTasks(tasks);
    return newTask;
  },

  update: async (id, updateData) => {
    const tasks = readTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return null;
    }

    tasks[index] = {
      ...tasks[index],
      ...updateData,
    };

    if (updateData.status === "已完成" && !tasks[index].completedAt) {
      tasks[index].completedAt = new Date().toISOString();
    }

    writeTasks(tasks);

    // 同步介入点1状态
    const task = tasks[index];
    if (task.claimCaseId) {
      try {
        const interventions = listByClaimCase(task.claimCaseId);
        const linked = interventions.find(
          (iv) =>
            iv.interventionType === "PARSE_LOW_CONFIDENCE" &&
            iv.reviewTaskId === id &&
            !iv.resolvedAt,
        );
        if (linked) {
          if (updateData.status === "已完成") {
            // 任务完成 → 介入实例进入修正已提交或接受原值
            const hasCorrections =
              updateData.manualInputData &&
              Object.keys(updateData.manualInputData).length > 0;
            if (linked.currentState === "REVIEW_IN_PROGRESS") {
              transitionState(
                linked.id,
                hasCorrections
                  ? "ADJUSTER_SUBMIT_CORRECTIONS"
                  : "ADJUSTER_ACCEPT_ORIGINAL",
                {
                  actorType: "adjuster",
                  actorName: updateData.reviewerName || task.reviewerName,
                  manualInputData: updateData.manualInputData,
                },
              );
              // 如果提交了修正，自动确认完成
              if (hasCorrections) {
                const updated = listByClaimCase(task.claimCaseId).find(
                  (iv) => iv.id === linked.id,
                );
                if (
                  updated &&
                  updated.currentState === "CORRECTION_SUBMITTED"
                ) {
                  transitionState(linked.id, "CORRECTIONS_FINALIZED", {
                    actorType: "system",
                  });
                }
              }
            }
          } else if (updateData.status === "已取消") {
            // 任务取消 → 手动解决介入
            if (!linked.resolvedAt) {
              const { resolveIntervention } =
                await import("./interventionStateMachine.js");
              resolveIntervention(linked.id, "ACCEPT_AS_IS", {
                actorType: "system",
                reason: "审核任务已取消",
              });
            }
          }
        }
      } catch (err) {
        console.warn("[intervention] 同步置信度介入状态失败:", err.message);
      }
    }

    return tasks[index];
  },

  delete: async (id) => {
    const tasks = readTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }
    tasks.splice(index, 1);
    writeTasks(tasks);
    return true;
  },

  saveAll: async (tasks) => {
    writeTasks(tasks);
    return tasks;
  },

  checkAndCreateTask: async (params) => {
    const {
      claimCaseId,
      reportNumber,
      materialId,
      materialName,
      documentId,
      ossUrl,
      ossKey,
      aiConfidence,
      threshold,
      aiExtractedData,
      aiErrorMessage,
      createdBy,
    } = params;

    if (aiConfidence >= threshold) {
      return null;
    }

    let priority = "中";
    if (aiConfidence < threshold * 0.5) {
      priority = "紧急";
    } else if (aiConfidence < threshold * 0.7) {
      priority = "高";
    } else if (aiConfidence < threshold * 0.9) {
      priority = "中";
    }

    const taskType = aiErrorMessage ? "AI识别失败" : "置信度不足";

    const task = await reviewTaskService.create({
      claimCaseId,
      reportNumber,
      materialId,
      materialName,
      documentId,
      ossUrl,
      ossKey,
      taskType,
      priority,
      aiConfidence,
      threshold,
      aiExtractedData,
      aiErrorMessage,
      createdBy,
    });

    // 创建介入点1实例：材料识别置信度不足
    try {
      const priorityMap = {
        紧急: "URGENT",
        高: "HIGH",
        中: "MEDIUM",
        低: "LOW",
      };
      const confPct =
        typeof aiConfidence === "number"
          ? `${Math.round(aiConfidence * 100)}%`
          : "N/A";
      const thrPct =
        typeof threshold === "number"
          ? `${Math.round(threshold * 100)}%`
          : "N/A";
      createIntervention({
        claimCaseId,
        stageKey: "parse",
        interventionType: "PARSE_LOW_CONFIDENCE",
        reason: {
          code: aiErrorMessage ? "AI_ERROR" : "LOW_CONFIDENCE",
          summary: aiErrorMessage
            ? `材料「${materialName || "未知"}」AI识别失败`
            : `材料「${materialName || "未知"}」置信度 ${confPct}，低于阈值 ${thrPct}`,
          detail: aiErrorMessage
            ? `材料「${materialName || "未知"}」AI识别失败：${aiErrorMessage}`
            : `材料「${materialName || "未知"}」的 AI 识别置信度为 ${confPct}，低于预设阈值 ${thrPct}，需人工核对`,
          sourceField: materialName,
          confidence: aiConfidence,
          threshold,
        },
        priority: priorityMap[priority] || "MEDIUM",
        reviewTaskId: task.id,
      });
    } catch (err) {
      console.warn("[intervention] 创建置信度介入失败:", err.message);
    }

    return task;
  },

  getStats: async () => {
    const tasks = readTasks();
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "待处理").length,
      inProgress: tasks.filter((t) => t.status === "处理中").length,
      completed: tasks.filter((t) => t.status === "已完成").length,
      byPriority: {
        urgent: tasks.filter((t) => t.priority === "紧急").length,
        high: tasks.filter((t) => t.priority === "高").length,
        medium: tasks.filter((t) => t.priority === "中").length,
        low: tasks.filter((t) => t.priority === "低").length,
      },
    };
  },
};

export default reviewTaskService;
