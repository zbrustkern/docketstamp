"use client";

import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import { DraftState, DraftStorage } from "./types";
import { draftReducer, DraftAction, createInitialDraft } from "./reducer";
import { loadDraft, saveDraft, clearDraft as clearStorageDraft, getBrowserSessionStorage } from "./store";

interface UseDraftOptions {
  storage?: DraftStorage;
  experienceVersion?: string;
  initialPresetId?: string;
  initialPresetTitle?: string;
  initialPresetUrl?: string;
}

export function useDraft(options: UseDraftOptions = {}) {
  const {
    storage = getBrowserSessionStorage(),
    experienceVersion = "candidate_v1",
    initialPresetId,
    initialPresetTitle,
    initialPresetUrl,
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [state, dispatch] = useReducer(draftReducer, createInitialDraft(experienceVersion));
  const storageRef = useRef<DraftStorage>(storage);
  storageRef.current = storage;

  // Hydrate on mount
  useEffect(() => {
    const existing = loadDraft(storageRef.current);
    if (existing) {
      dispatch({ type: "HYDRATE_DRAFT", payload: existing });
    } else {
      // If an initial preset was passed via URL/context and no draft was present:
      if (initialPresetId && initialPresetUrl && initialPresetTitle) {
        dispatch({
          type: "SELECT_DESIGN",
          payload: {
            presetId: initialPresetId,
            imageUrl: initialPresetUrl,
            title: initialPresetTitle,
            source: "preset",
            accepted: false, // Contextual recommendation is NOT accepted until explicit action
          },
        });
      }
    }
    setIsLoaded(true);
  }, [initialPresetId, initialPresetUrl, initialPresetTitle]);

  // Persist state updates
  useEffect(() => {
    if (!isLoaded) return;
    saveDraft(state, storageRef.current);
  }, [state, isLoaded]);

  const handleClearDraft = useCallback(() => {
    clearStorageDraft(storageRef.current);
    dispatch({ type: "CLEAR_DRAFT", payload: { experienceVersion } });
  }, [experienceVersion]);

  return {
    draft: state,
    dispatch,
    clearDraft: handleClearDraft,
    isLoaded,
  };
}
