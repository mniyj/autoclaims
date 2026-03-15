import type { IntakeConfig, IntakeField, Policy } from "../types";

export type ClaimOrchestratorState =
  | "IDLE"
  | "SELECTING_POLICY"
  | "CONFIRMING_POLICY"
  | "COLLECTING_FIELDS"
  | "MODIFYING_FIELD"
  | "CONFIRMING_SUBMISSION"
  | "SUBMITTING"
  | "ENDED"
  | "ERROR";

export interface ClaimantIdentity {
  userId?: string;
  username?: string;
  companyCode?: string;
}

export interface ClaimOrchestratorSnapshot {
  state: ClaimOrchestratorState;
  claimant: ClaimantIdentity;
  availablePolicies: Policy[];
  selectedPolicy: Policy | null;
  intakeConfig: IntakeConfig | null;
  collectedFields: Record<string, unknown>;
  pendingFieldId: string | null;
  lastResponse?: string;
}

export class ClaimOrchestratorContext {
  private state: ClaimOrchestratorState = "IDLE";
  private claimant: ClaimantIdentity;
  private availablePolicies: Policy[] = [];
  private selectedPolicy: Policy | null = null;
  private intakeConfig: IntakeConfig | null = null;
  private collectedFields: Record<string, unknown> = {};
  private pendingFieldId: string | null = null;
  private lastResponse?: string;

  constructor(claimant: ClaimantIdentity = {}) {
    this.claimant = claimant;
  }

  setState(nextState: ClaimOrchestratorState): void {
    this.state = nextState;
  }

  getState(): ClaimOrchestratorState {
    return this.state;
  }

  getClaimant(): ClaimantIdentity {
    return { ...this.claimant };
  }

  setAvailablePolicies(policies: Policy[]): void {
    this.availablePolicies = policies;
  }

  getAvailablePolicies(): Policy[] {
    return [...this.availablePolicies];
  }

  setSelectedPolicy(policy: Policy | null): void {
    this.selectedPolicy = policy;
  }

  getSelectedPolicy(): Policy | null {
    return this.selectedPolicy;
  }

  setIntakeConfig(config: IntakeConfig | null): void {
    this.intakeConfig = config;
    this.pendingFieldId = this.getNextRequiredField()?.field_id || null;
  }

  getIntakeConfig(): IntakeConfig | null {
    return this.intakeConfig;
  }

  updateField(fieldId: string, value: unknown): void {
    this.collectedFields[fieldId] = value;
    this.pendingFieldId = this.getNextRequiredField()?.field_id || null;
  }

  getField(fieldId: string): unknown {
    return this.collectedFields[fieldId];
  }

  getCollectedFields(): Record<string, unknown> {
    return { ...this.collectedFields };
  }

  getMissingRequiredFields(): IntakeField[] {
    if (!this.intakeConfig) {
      return [];
    }

    return this.intakeConfig.fields.filter(
      (field) => field.required && !(field.field_id in this.collectedFields),
    );
  }

  getNextRequiredField(): IntakeField | null {
    return this.getMissingRequiredFields()[0] || null;
  }

  getPendingFieldId(): string | null {
    return this.pendingFieldId;
  }

  setPendingFieldId(fieldId: string | null): void {
    this.pendingFieldId = fieldId;
  }

  setLastResponse(response: string): void {
    this.lastResponse = response;
  }

  getSnapshot(): ClaimOrchestratorSnapshot {
    return {
      state: this.state,
      claimant: this.getClaimant(),
      availablePolicies: this.getAvailablePolicies(),
      selectedPolicy: this.selectedPolicy,
      intakeConfig: this.intakeConfig,
      collectedFields: this.getCollectedFields(),
      pendingFieldId: this.pendingFieldId,
      lastResponse: this.lastResponse,
    };
  }

  reset(): void {
    this.state = "IDLE";
    this.availablePolicies = [];
    this.selectedPolicy = null;
    this.intakeConfig = null;
    this.collectedFields = {};
    this.pendingFieldId = null;
    this.lastResponse = undefined;
  }
}
