export var ProductStatus;
(function (ProductStatus) {
    ProductStatus["DRAFT"] = "\u8349\u7A3F";
    ProductStatus["ACTIVE"] = "\u751F\u6548";
    ProductStatus["INACTIVE"] = "\u5931\u6548";
})(ProductStatus || (ProductStatus = {}));
export var PrimaryCategory;
(function (PrimaryCategory) {
    PrimaryCategory["HEALTH"] = "\u533B\u7597\u4FDD\u9669";
    PrimaryCategory["ACCIDENT"] = "\u610F\u5916\u4FDD\u9669";
    PrimaryCategory["CRITICAL_ILLNESS"] = "\u91CD\u5927\u75BE\u75C5\u4FDD\u9669";
    PrimaryCategory["TERM_LIFE"] = "\u5B9A\u671F\u5BFF\u9669";
    PrimaryCategory["WHOLE_LIFE"] = "\u7EC8\u8EAB\u5BFF\u9669";
    PrimaryCategory["ANNUITY"] = "\u5E74\u91D1\u4FDD\u9669";
    PrimaryCategory["CAR_INSURANCE"] = "\u8F66\u9669";
})(PrimaryCategory || (PrimaryCategory = {}));
export var ClauseType;
(function (ClauseType) {
    ClauseType["MAIN"] = "\u4E3B\u9669";
    ClauseType["RIDER"] = "\u9644\u52A0\u9669";
})(ClauseType || (ClauseType = {}));
export var ClaimStatus;
(function (ClaimStatus) {
    ClaimStatus["REPORTED"] = "\u5DF2\u62A5\u6848";
    ClaimStatus["PROCESSING"] = "\u5904\u7406\u4E2D";
    ClaimStatus["PENDING_INFO"] = "\u5F85\u8865\u4F20";
    ClaimStatus["APPROVED"] = "\u5DF2\u7ED3\u6848-\u7ED9\u4ED8";
    ClaimStatus["REJECTED"] = "\u5DF2\u7ED3\u6848-\u62D2\u8D54";
    ClaimStatus["CANCELLED"] = "\u5DF2\u64A4\u6848";
})(ClaimStatus || (ClaimStatus = {}));
// --- END: Types for Claim Intake Configuration ---
// --- START: Types for Ruleset Management ---
export var RulesetProductLine;
(function (RulesetProductLine) {
    RulesetProductLine["ACCIDENT"] = "ACCIDENT";
    RulesetProductLine["HEALTH"] = "HEALTH";
    RulesetProductLine["CRITICAL_ILLNESS"] = "CRITICAL_ILLNESS";
    RulesetProductLine["TERM_LIFE"] = "TERM_LIFE";
    RulesetProductLine["WHOLE_LIFE"] = "WHOLE_LIFE";
    RulesetProductLine["ANNUITY"] = "ANNUITY";
})(RulesetProductLine || (RulesetProductLine = {}));
export var ExecutionDomain;
(function (ExecutionDomain) {
    ExecutionDomain["ELIGIBILITY"] = "ELIGIBILITY";
    ExecutionDomain["ASSESSMENT"] = "ASSESSMENT";
    ExecutionDomain["POST_PROCESS"] = "POST_PROCESS";
})(ExecutionDomain || (ExecutionDomain = {}));
export var RuleStatus;
(function (RuleStatus) {
    RuleStatus["EFFECTIVE"] = "EFFECTIVE";
    RuleStatus["DISABLED"] = "DISABLED";
    RuleStatus["DRAFT"] = "DRAFT";
})(RuleStatus || (RuleStatus = {}));
export var RuleActionType;
(function (RuleActionType) {
    RuleActionType["APPROVE_CLAIM"] = "APPROVE_CLAIM";
    RuleActionType["REJECT_CLAIM"] = "REJECT_CLAIM";
    RuleActionType["SET_CLAIM_RATIO"] = "SET_CLAIM_RATIO";
    RuleActionType["ROUTE_CLAIM_MANUAL"] = "ROUTE_CLAIM_MANUAL";
    RuleActionType["FLAG_FRAUD"] = "FLAG_FRAUD";
    RuleActionType["TERMINATE_CONTRACT"] = "TERMINATE_CONTRACT";
    RuleActionType["APPROVE_ITEM"] = "APPROVE_ITEM";
    RuleActionType["REJECT_ITEM"] = "REJECT_ITEM";
    RuleActionType["ADJUST_ITEM_AMOUNT"] = "ADJUST_ITEM_AMOUNT";
    RuleActionType["SET_ITEM_RATIO"] = "SET_ITEM_RATIO";
    RuleActionType["FLAG_ITEM"] = "FLAG_ITEM";
    RuleActionType["APPLY_FORMULA"] = "APPLY_FORMULA";
    RuleActionType["APPLY_CAP"] = "APPLY_CAP";
    RuleActionType["APPLY_DEDUCTIBLE"] = "APPLY_DEDUCTIBLE";
    RuleActionType["SUM_COVERAGES"] = "SUM_COVERAGES";
    RuleActionType["DEDUCT_PRIOR_BENEFIT"] = "DEDUCT_PRIOR_BENEFIT";
    RuleActionType["ADD_REMARK"] = "ADD_REMARK";
})(RuleActionType || (RuleActionType = {}));
export var RuleCategory;
(function (RuleCategory) {
    RuleCategory["COVERAGE_SCOPE"] = "COVERAGE_SCOPE";
    RuleCategory["EXCLUSION"] = "EXCLUSION";
    RuleCategory["WAITING_PERIOD"] = "WAITING_PERIOD";
    RuleCategory["CLAIM_TIMELINE"] = "CLAIM_TIMELINE";
    RuleCategory["COVERAGE_PERIOD"] = "COVERAGE_PERIOD";
    RuleCategory["POLICY_STATUS"] = "POLICY_STATUS";
    RuleCategory["ITEM_CLASSIFICATION"] = "ITEM_CLASSIFICATION";
    RuleCategory["PRICING_REASONABILITY"] = "PRICING_REASONABILITY";
    RuleCategory["DISABILITY_ASSESSMENT"] = "DISABILITY_ASSESSMENT";
    RuleCategory["DEPRECIATION"] = "DEPRECIATION";
    RuleCategory["PROPORTIONAL_LIABILITY"] = "PROPORTIONAL_LIABILITY";
    RuleCategory["DEDUCTIBLE"] = "DEDUCTIBLE";
    RuleCategory["SUB_LIMIT"] = "SUB_LIMIT";
    RuleCategory["SOCIAL_INSURANCE"] = "SOCIAL_INSURANCE";
    RuleCategory["BENEFIT_OFFSET"] = "BENEFIT_OFFSET";
    RuleCategory["AGGREGATE_CAP"] = "AGGREGATE_CAP";
    RuleCategory["POST_ADJUSTMENT"] = "POST_ADJUSTMENT";
})(RuleCategory || (RuleCategory = {}));
export var ConditionOperator;
(function (ConditionOperator) {
    ConditionOperator["EQ"] = "EQ";
    ConditionOperator["NE"] = "NE";
    ConditionOperator["GT"] = "GT";
    ConditionOperator["GTE"] = "GTE";
    ConditionOperator["LT"] = "LT";
    ConditionOperator["LTE"] = "LTE";
    ConditionOperator["IN"] = "IN";
    ConditionOperator["NOT_IN"] = "NOT_IN";
    ConditionOperator["CONTAINS"] = "CONTAINS";
    ConditionOperator["NOT_CONTAINS"] = "NOT_CONTAINS";
    ConditionOperator["STARTS_WITH"] = "STARTS_WITH";
    ConditionOperator["BETWEEN"] = "BETWEEN";
    ConditionOperator["IS_NULL"] = "IS_NULL";
    ConditionOperator["IS_NOT_NULL"] = "IS_NOT_NULL";
    ConditionOperator["IS_TRUE"] = "IS_TRUE";
    ConditionOperator["IS_FALSE"] = "IS_FALSE";
    ConditionOperator["MATCHES_REGEX"] = "MATCHES_REGEX";
})(ConditionOperator || (ConditionOperator = {}));
export var ConditionLogic;
(function (ConditionLogic) {
    ConditionLogic["AND"] = "AND";
    ConditionLogic["OR"] = "OR";
    ConditionLogic["NOT"] = "NOT";
    ConditionLogic["ALWAYS_TRUE"] = "ALWAYS_TRUE";
})(ConditionLogic || (ConditionLogic = {}));
// --- START: Types for Review Task (Manual Review Work Order) ---
export var ReviewTaskStatus;
(function (ReviewTaskStatus) {
    ReviewTaskStatus["PENDING"] = "\u5F85\u5904\u7406";
    ReviewTaskStatus["IN_PROGRESS"] = "\u5904\u7406\u4E2D";
    ReviewTaskStatus["COMPLETED"] = "\u5DF2\u5B8C\u6210";
    ReviewTaskStatus["CANCELLED"] = "\u5DF2\u53D6\u6D88";
})(ReviewTaskStatus || (ReviewTaskStatus = {}));
export var ReviewTaskPriority;
(function (ReviewTaskPriority) {
    ReviewTaskPriority["LOW"] = "\u4F4E";
    ReviewTaskPriority["MEDIUM"] = "\u4E2D";
    ReviewTaskPriority["HIGH"] = "\u9AD8";
    ReviewTaskPriority["URGENT"] = "\u7D27\u6025";
})(ReviewTaskPriority || (ReviewTaskPriority = {}));
export var ReviewTaskType;
(function (ReviewTaskType) {
    ReviewTaskType["LOW_CONFIDENCE"] = "\u7F6E\u4FE1\u5EA6\u4E0D\u8DB3";
    ReviewTaskType["AI_ERROR"] = "AI\u8BC6\u522B\u5931\u8D25";
    ReviewTaskType["MANUAL_REQUEST"] = "\u4EBA\u5DE5\u8BF7\u6C42";
    ReviewTaskType["COMPLIANCE_CHECK"] = "\u5408\u89C4\u68C0\u67E5";
})(ReviewTaskType || (ReviewTaskType = {}));
// --- END: Types for Review Task ---
// --- END: Types for Medical Invoice Audit & Insurance Catalog ---
// --- START: Types for Quote and Policy Management ---
// 询价单状态
export var QuoteStatus;
(function (QuoteStatus) {
    QuoteStatus["DRAFT"] = "\u8349\u7A3F";
    QuoteStatus["PENDING"] = "\u5F85\u62A5\u4EF7";
    QuoteStatus["QUOTED"] = "\u5DF2\u62A5\u4EF7";
    QuoteStatus["ACCEPTED"] = "\u5DF2\u63A5\u53D7";
    QuoteStatus["REJECTED"] = "\u5DF2\u62D2\u7EDD";
    QuoteStatus["EXPIRED"] = "\u5DF2\u8FC7\u671F";
    QuoteStatus["CONVERTED"] = "\u5DF2\u8F6C\u4FDD\u5355";
})(QuoteStatus || (QuoteStatus = {}));
// 保单状态
export var PolicyStatus;
(function (PolicyStatus) {
    PolicyStatus["DRAFT"] = "\u8349\u7A3F";
    PolicyStatus["PENDING_PAYMENT"] = "\u5F85\u652F\u4ED8";
    PolicyStatus["EFFECTIVE"] = "\u751F\u6548\u4E2D";
    PolicyStatus["LAPSED"] = "\u5931\u6548";
    PolicyStatus["SURRENDERED"] = "\u5DF2\u9000\u4FDD";
    PolicyStatus["EXPIRED"] = "\u5DF2\u6EE1\u671F";
    PolicyStatus["CANCELLED"] = "\u5DF2\u6CE8\u9500";
})(PolicyStatus || (PolicyStatus = {}));
// 询价类型
export var QuoteType;
(function (QuoteType) {
    QuoteType["INDIVIDUAL"] = "\u4E2A\u4EBA\u8BE2\u4EF7";
    QuoteType["GROUP"] = "\u56E2\u4F53\u8BE2\u4EF7";
})(QuoteType || (QuoteType = {}));
// --- END: Types for Quote and Policy Management ---
// --- START: Types for User Operation Logs ---
// 用户操作类型枚举（涵盖所有C端用户操作）
export var UserOperationType;
(function (UserOperationType) {
    UserOperationType["LOGIN"] = "LOGIN";
    UserOperationType["LOGOUT"] = "LOGOUT";
    UserOperationType["REPORT_CLAIM"] = "REPORT_CLAIM";
    UserOperationType["UPLOAD_FILE"] = "UPLOAD_FILE";
    UserOperationType["DELETE_FILE"] = "DELETE_FILE";
    UserOperationType["VIEW_FILE"] = "VIEW_FILE";
    UserOperationType["SEND_MESSAGE"] = "SEND_MESSAGE";
    UserOperationType["RECEIVE_MESSAGE"] = "RECEIVE_MESSAGE";
    UserOperationType["VIEW_PROGRESS"] = "VIEW_PROGRESS";
    UserOperationType["VIEW_CLAIM_DETAIL"] = "VIEW_CLAIM_DETAIL";
    UserOperationType["SUBMIT_FORM"] = "SUBMIT_FORM";
    UserOperationType["UPDATE_PROFILE"] = "UPDATE_PROFILE";
    UserOperationType["ANALYZE_DOCUMENT"] = "ANALYZE_DOCUMENT";
    UserOperationType["QUICK_ANALYZE"] = "QUICK_ANALYZE";
    UserOperationType["VOICE_TRANSCRIPTION"] = "VOICE_TRANSCRIPTION";
    UserOperationType["LIVE_AUDIO_SESSION"] = "LIVE_AUDIO_SESSION";
    UserOperationType["GENERATE_REPORT"] = "GENERATE_REPORT";
    UserOperationType["CLAIM_ACTION"] = "CLAIM_ACTION";
    UserOperationType["IMPORT_MATERIALS"] = "IMPORT_MATERIALS";
    UserOperationType["TASK_CREATE"] = "TASK_CREATE";
    UserOperationType["SYSTEM_CALL"] = "SYSTEM_CALL";
})(UserOperationType || (UserOperationType = {}));
//# sourceMappingURL=types.js.map