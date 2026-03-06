export var ClaimStatus;
(function (ClaimStatus) {
    ClaimStatus["REPORTING"] = "REPORTING";
    ClaimStatus["DOCUMENTING"] = "DOCUMENTING";
    ClaimStatus["REVIEWING"] = "REVIEWING";
    ClaimStatus["SETTLED"] = "SETTLED";
    ClaimStatus["PAYING"] = "PAYING";
    ClaimStatus["PAID"] = "PAID";
    ClaimStatus["REJECTED"] = "REJECTED";
})(ClaimStatus || (ClaimStatus = {}));
// ============================================================================
// 意图识别相关类型
// ============================================================================
/** 用户意图类型 */
export var IntentType;
(function (IntentType) {
    // ---- 报案类 ----
    /** 新报案 */
    IntentType["REPORT_NEW_CLAIM"] = "REPORT_NEW_CLAIM";
    /** 续填报案 */
    IntentType["RESUME_CLAIM_REPORT"] = "RESUME_CLAIM_REPORT";
    /** 修改报案信息 */
    IntentType["MODIFY_CLAIM_REPORT"] = "MODIFY_CLAIM_REPORT";
    /** 撤销报案 */
    IntentType["CANCEL_CLAIM"] = "CANCEL_CLAIM";
    // ---- 材料上传类 ----
    /** 上传理赔材料 */
    IntentType["UPLOAD_DOCUMENT"] = "UPLOAD_DOCUMENT";
    /** 补充材料 */
    IntentType["SUPPLEMENT_DOCUMENT"] = "SUPPLEMENT_DOCUMENT";
    /** 查看已上传材料 */
    IntentType["VIEW_UPLOADED_DOCUMENTS"] = "VIEW_UPLOADED_DOCUMENTS";
    /** 删除/替换材料 */
    IntentType["REPLACE_DOCUMENT"] = "REPLACE_DOCUMENT";
    // ---- 查询类 ----
    /** 查询理赔进度 */
    IntentType["QUERY_PROGRESS"] = "QUERY_PROGRESS";
    /** 查询理赔材料清单 */
    IntentType["QUERY_MATERIALS_LIST"] = "QUERY_MATERIALS_LIST";
    /** 查询缺失材料 */
    IntentType["QUERY_MISSING_MATERIALS"] = "QUERY_MISSING_MATERIALS";
    /** 查询保费影响 */
    IntentType["QUERY_PREMIUM_IMPACT"] = "QUERY_PREMIUM_IMPACT";
    /** 查询赔付金额 */
    IntentType["QUERY_SETTLEMENT_AMOUNT"] = "QUERY_SETTLEMENT_AMOUNT";
    /** 查询赔付明细 */
    IntentType["QUERY_SETTLEMENT_DETAIL"] = "QUERY_SETTLEMENT_DETAIL";
    /** 查询保单信息 */
    IntentType["QUERY_POLICY_INFO"] = "QUERY_POLICY_INFO";
    /** 查询历史案件 */
    IntentType["QUERY_CLAIM_HISTORY"] = "QUERY_CLAIM_HISTORY";
    /** 查询打款状态 */
    IntentType["QUERY_PAYMENT_STATUS"] = "QUERY_PAYMENT_STATUS";
    // ---- 协助类 ----
    /** 理赔流程指引 */
    IntentType["GUIDE_CLAIM_PROCESS"] = "GUIDE_CLAIM_PROCESS";
    /** 材料拍摄指导 */
    IntentType["GUIDE_DOCUMENT_PHOTO"] = "GUIDE_DOCUMENT_PHOTO";
    /** 理赔时效说明 */
    IntentType["QUERY_CLAIM_TIMELINE"] = "QUERY_CLAIM_TIMELINE";
    /** 责任范围咨询 */
    IntentType["QUERY_COVERAGE"] = "QUERY_COVERAGE";
    /** 常见问题 */
    IntentType["QUERY_FAQ"] = "QUERY_FAQ";
    // ---- 沟通类 ----
    /** 转人工客服 */
    IntentType["TRANSFER_TO_AGENT"] = "TRANSFER_TO_AGENT";
    /** 投诉/申诉 */
    IntentType["FILE_COMPLAINT"] = "FILE_COMPLAINT";
    /** 催办/加急 */
    IntentType["EXPEDITE_CLAIM"] = "EXPEDITE_CLAIM";
    /** 留言/备注 */
    IntentType["LEAVE_MESSAGE"] = "LEAVE_MESSAGE";
    // ---- 操作类 ----
    /** 修改收款信息 */
    IntentType["UPDATE_BANK_INFO"] = "UPDATE_BANK_INFO";
    /** 确认赔付方案 */
    IntentType["CONFIRM_SETTLEMENT"] = "CONFIRM_SETTLEMENT";
    /** 拒绝赔付方案 */
    IntentType["REJECT_SETTLEMENT"] = "REJECT_SETTLEMENT";
    /** 签署协议/授权 */
    IntentType["SIGN_AGREEMENT"] = "SIGN_AGREEMENT";
    // ---- 兜底类 ----
    /** 普通对话 */
    IntentType["GENERAL_CHAT"] = "GENERAL_CHAT";
    /** 意图不明 */
    IntentType["UNCLEAR_INTENT"] = "UNCLEAR_INTENT";
    /** 超出能力范围 */
    IntentType["OUT_OF_SCOPE"] = "OUT_OF_SCOPE";
})(IntentType || (IntentType = {}));
/** UI组件类型 */
export var UIComponentType;
(function (UIComponentType) {
    // 已有
    /** 理赔进度卡片 */
    UIComponentType["CLAIM_PROGRESS"] = "CLAIM_PROGRESS";
    /** 材料清单 */
    UIComponentType["MATERIALS_LIST"] = "MATERIALS_LIST";
    /** 缺失材料提醒 */
    UIComponentType["MISSING_MATERIALS"] = "MISSING_MATERIALS";
    /** 保费影响说明 */
    UIComponentType["PREMIUM_IMPACT"] = "PREMIUM_IMPACT";
    // 报案类
    /** 报案表单 */
    UIComponentType["CLAIM_REPORT_FORM"] = "CLAIM_REPORT_FORM";
    // 材料类
    /** 材料上传器 */
    UIComponentType["DOCUMENT_UPLOADER"] = "DOCUMENT_UPLOADER";
    /** 已上传材料列表 */
    UIComponentType["UPLOADED_DOCUMENTS"] = "UPLOADED_DOCUMENTS";
    // 查询类扩展
    /** 案件选择 */
    UIComponentType["CLAIM_SELECTION"] = "CLAIM_SELECTION";
    /** 赔付预估 */
    UIComponentType["SETTLEMENT_ESTIMATE"] = "SETTLEMENT_ESTIMATE";
    /** 赔付明细 */
    UIComponentType["SETTLEMENT_DETAIL"] = "SETTLEMENT_DETAIL";
    /** 保单信息 */
    UIComponentType["POLICY_INFO"] = "POLICY_INFO";
    /** 历史理赔 */
    UIComponentType["CLAIM_HISTORY"] = "CLAIM_HISTORY";
    /** 打款状态 */
    UIComponentType["PAYMENT_STATUS"] = "PAYMENT_STATUS";
    // 协助类
    /** 理赔流程指引 */
    UIComponentType["PROCESS_GUIDE"] = "PROCESS_GUIDE";
    /** 材料拍摄指导 */
    UIComponentType["PHOTO_GUIDE"] = "PHOTO_GUIDE";
    /** 时效说明 */
    UIComponentType["TIMELINE_INFO"] = "TIMELINE_INFO";
    /** 保障范围 */
    UIComponentType["COVERAGE_INFO"] = "COVERAGE_INFO";
    /** 常见问题 */
    UIComponentType["FAQ_LIST"] = "FAQ_LIST";
    // 操作类
    /** 银行信息表单 */
    UIComponentType["BANK_INFO_FORM"] = "BANK_INFO_FORM";
    /** 赔付方案确认 */
    UIComponentType["SETTLEMENT_CONFIRMATION"] = "SETTLEMENT_CONFIRMATION";
    /** 投诉/申诉表单 */
    UIComponentType["COMPLAINT_FORM"] = "COMPLAINT_FORM";
    /** 协议签署 */
    UIComponentType["AGREEMENT_SIGN"] = "AGREEMENT_SIGN";
    // 兜底类
    /** 意图澄清 */
    UIComponentType["CLARIFICATION"] = "CLARIFICATION";
})(UIComponentType || (UIComponentType = {}));
//# sourceMappingURL=types.js.map