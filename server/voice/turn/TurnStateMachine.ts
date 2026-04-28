import type { TurnState } from "../../../types/voice.js";

/**
 * Named transitions. The state machine only advances via these.
 * Keep this list exhaustive — adding a transition requires updating the table.
 */
export type TurnTransition =
  | "GREETING_SENT"       // IDLE → SPEAKING (opening greeting TTS begins)
  | "PLAYBACK_ENDED"      // SPEAKING → LISTENING (client confirmed TTS fully played)
  | "STT_FINAL"           // LISTENING → THINKING (final transcript received)
  | "REPLY_READY"         // THINKING → SPEAKING (server starts TTS for reply)
  | "BARGE_IN"            // SPEAKING → LISTENING (user interrupted TTS)
  | "CANCEL"              // any → LISTENING (user said "取消")
  | "SESSION_END";        // any → IDLE (terminal)

/**
 * Transition table. Each row: (fromState, transition) → toState.
 * Absence from this table means the transition is illegal in that state.
 */
const TRANSITIONS: Readonly<Record<TurnState, Partial<Record<TurnTransition, TurnState>>>> = {
  IDLE: {
    GREETING_SENT: "SPEAKING",
    SESSION_END: "IDLE",
  },
  LISTENING: {
    STT_FINAL: "THINKING",
    CANCEL: "LISTENING",
    SESSION_END: "IDLE",
  },
  THINKING: {
    REPLY_READY: "SPEAKING",
    BARGE_IN: "LISTENING",
    CANCEL: "LISTENING",
    SESSION_END: "IDLE",
  },
  SPEAKING: {
    PLAYBACK_ENDED: "LISTENING",
    BARGE_IN: "LISTENING",
    CANCEL: "LISTENING",
    SESSION_END: "IDLE",
  },
};

export interface TransitionEvent {
  from: TurnState;
  to: TurnState;
  transition: TurnTransition;
  turnId: string;
  reason?: string;
  timestamp: number;
}

export type TransitionListener = (event: TransitionEvent) => void;

/**
 * Pure, in-memory turn-state machine. No I/O.
 *
 * Usage:
 *   const fsm = new TurnStateMachine();
 *   fsm.onTransition((e) => log(e));
 *   fsm.dispatch("GREETING_SENT", { turnId: "t1", reason: "greeting" });
 */
export class TurnStateMachine {
  private state: TurnState = "IDLE";
  private listeners: TransitionListener[] = [];

  getState(): TurnState {
    return this.state;
  }

  /**
   * Attempt a transition. Returns the new state.
   * Throws if the transition is illegal from the current state — callers should
   * avoid illegal transitions rather than catching; an illegal transition means
   * a logic bug upstream, not an expected runtime condition.
   */
  dispatch(
    transition: TurnTransition,
    opts: { turnId: string; reason?: string },
  ): TurnState {
    const from = this.state;
    const to = TRANSITIONS[from]?.[transition];
    if (!to) {
      throw new Error(
        `[TurnStateMachine] Illegal transition ${transition} from state ${from}`,
      );
    }

    this.state = to;
    const event: TransitionEvent = {
      from,
      to,
      transition,
      turnId: opts.turnId,
      reason: opts.reason,
      timestamp: Date.now(),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        // A faulty listener must not break the state machine.
        console.error("[TurnStateMachine] listener threw:", err);
      }
    }
    return to;
  }

  /**
   * Non-throwing variant: returns null instead of throwing. Useful when the
   * caller might race (e.g. two code paths both trying to move SPEAKING → LISTENING).
   */
  tryDispatch(
    transition: TurnTransition,
    opts: { turnId: string; reason?: string },
  ): TurnState | null {
    const to = TRANSITIONS[this.state]?.[transition];
    if (!to) return null;
    return this.dispatch(transition, opts);
  }

  onTransition(listener: TransitionListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** For diagnostics: list allowed transitions from current state. */
  allowedTransitions(): TurnTransition[] {
    return Object.keys(TRANSITIONS[this.state] ?? {}) as TurnTransition[];
  }
}
