import {
  DraftState,
  DRAFT_SCHEMA_VERSION,
  SelectedDesign,
  NoteDraft,
  AddressDraft,
  ScheduleDraft,
  AttributionDraft,
  CustomGenerationState,
} from "./types";

export type DraftAction =
  | {
      type: "SELECT_DESIGN";
      payload: {
        presetId?: string;
        customId?: string;
        imageUrl: string;
        title: string;
        source: "preset" | "custom";
        accepted?: boolean;
      };
    }
  | { type: "ACCEPT_DESIGN" }
  | { type: "UPDATE_NOTE"; payload: Partial<NoteDraft> }
  | { type: "UPDATE_RECIPIENT"; payload: AddressDraft | null }
  | { type: "UPDATE_SENDER"; payload: AddressDraft | null }
  | { type: "UPDATE_SCHEDULE"; payload: ScheduleDraft | null }
  | { type: "SET_DISCOUNT_CODE"; payload: string | null }
  | { type: "SET_ATTRIBUTION"; payload: AttributionDraft | null }
  | { type: "SET_CUSTOM_GENERATION"; payload: Partial<CustomGenerationState> }
  | { type: "SET_CHECKOUT_SNAPSHOT"; payload: string | null }
  | { type: "CLEAR_DRAFT"; payload?: { experienceVersion?: string } }
  | { type: "HYDRATE_DRAFT"; payload: DraftState };

export function createInitialDraft(experienceVersion = "candidate_v1"): DraftState {
  const now = Date.now();
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    draftRevision: 0,
    experienceVersion,
    selectedDesign: null,
    note: {
      text: "",
      style: "hwDavid",
    },
    recipient: null,
    sender: null,
    schedule: null,
    discountCode: null,
    attribution: null,
    customGeneration: {
      status: "idle",
    },
    checkoutSnapshotId: null,
  };
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  const now = Date.now();

  switch (action.type) {
    case "SELECT_DESIGN": {
      const isSameSelection =
        state.selectedDesign !== null &&
        state.selectedDesign.imageUrl === action.payload.imageUrl &&
        state.selectedDesign.title === action.payload.title &&
        state.selectedDesign.source === action.payload.source;

      // If already selected and accepted status is unchanged, don't unnecessarily increment
      if (
        isSameSelection &&
        state.selectedDesign &&
        (action.payload.accepted ?? false) === state.selectedDesign.accepted
      ) {
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        draftRevision: state.draftRevision + 1,
        selectedDesign: {
          presetId: action.payload.presetId,
          customId: action.payload.customId,
          imageUrl: action.payload.imageUrl,
          title: action.payload.title,
          source: action.payload.source,
          accepted: action.payload.accepted ?? false,
        },
      };
    }

    case "ACCEPT_DESIGN": {
      if (!state.selectedDesign) return state;
      if (state.selectedDesign.accepted) return state;

      return {
        ...state,
        updatedAt: now,
        draftRevision: state.draftRevision + 1,
        selectedDesign: {
          ...state.selectedDesign,
          accepted: true,
        },
      };
    }

    case "UPDATE_NOTE": {
      return {
        ...state,
        updatedAt: now,
        draftRevision: state.draftRevision + 1,
        note: {
          ...state.note,
          ...action.payload,
        },
      };
    }

    case "UPDATE_RECIPIENT": {
      return {
        ...state,
        updatedAt: now,
        draftRevision: state.draftRevision + 1,
        recipient: action.payload,
      };
    }

    case "UPDATE_SENDER": {
      return {
        ...state,
        updatedAt: now,
        draftRevision: state.draftRevision + 1,
        sender: action.payload,
      };
    }

    case "UPDATE_SCHEDULE": {
      return {
        ...state,
        updatedAt: now,
        draftRevision: state.draftRevision + 1,
        schedule: action.payload,
      };
    }

    case "SET_DISCOUNT_CODE": {
      if (state.discountCode === action.payload) return state;
      return {
        ...state,
        updatedAt: now,
        discountCode: action.payload,
      };
    }

    case "SET_ATTRIBUTION": {
      return {
        ...state,
        updatedAt: now,
        attribution: action.payload,
      };
    }

    case "SET_CUSTOM_GENERATION": {
      return {
        ...state,
        updatedAt: now,
        customGeneration: {
          ...state.customGeneration,
          ...action.payload,
        },
      };
    }

    case "SET_CHECKOUT_SNAPSHOT": {
      return {
        ...state,
        updatedAt: now,
        checkoutSnapshotId: action.payload,
      };
    }

    case "CLEAR_DRAFT": {
      return createInitialDraft(action.payload?.experienceVersion ?? state.experienceVersion);
    }

    case "HYDRATE_DRAFT": {
      return action.payload;
    }

    default:
      return state;
  }
}
