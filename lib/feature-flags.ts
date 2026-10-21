import { getSystemConfig, setSystemConfig } from "./firebase-admin";

export const FEATURE_FLAGS_CONFIG_ID = "feature_flags";

export type FeatureFlagsMap = Record<string, boolean>;

export interface FeatureFlagsDoc {
  flags?: Record<string, boolean>;
  updatedAt?: number;
  updatedBy?: string;
  [key: string]: unknown;
}

export interface FeatureFlagsState {
  flags: FeatureFlagsMap;
  updatedAt?: number;
  updatedBy?: string;
}

// Keep the console control flag opt-in until a consumer is registered.
export const DEFAULT_FEATURE_FLAGS: FeatureFlagsMap = {
  ceoConsoleV1: false,
};

/** Loads the complete flag state from Firestore with fallback defaults. */
export async function getFeatureFlagsState(): Promise<FeatureFlagsState> {
  try {
    const config = await getSystemConfig<FeatureFlagsDoc>(FEATURE_FLAGS_CONFIG_ID);
    const flags: FeatureFlagsMap = { ...DEFAULT_FEATURE_FLAGS };

    if (config?.flags && typeof config.flags === "object") {
      for (const [key, value] of Object.entries(config.flags)) {
        if (key !== "reworkV3Experience" && typeof value === "boolean") flags[key] = value;
      }
    }

    // Read older top-level boolean fields during migration.
    if (config) {
      for (const [key, value] of Object.entries(config)) {
        if (
          key !== "reworkV3Experience" &&
          !["flags", "updatedAt", "updatedBy", "id"].includes(key) &&
          typeof value === "boolean"
        ) {
          flags[key] = value;
        }
      }
    }

    return {
      flags,
      updatedAt: typeof config?.updatedAt === "number" ? config.updatedAt : undefined,
      updatedBy: typeof config?.updatedBy === "string" ? config.updatedBy : undefined,
    };
  } catch (error) {
    console.warn("[getFeatureFlagsState] Error reading feature flags from Firestore, using defaults:", error);
    return { flags: { ...DEFAULT_FEATURE_FLAGS } };
  }
}

/** Updates one flag without discarding other stored controls. */
export async function updateFeatureFlag(
  key: string,
  value: boolean,
  updatedBy = "system"
): Promise<FeatureFlagsMap> {
  const currentState = await getFeatureFlagsState();
  const flags = { ...currentState.flags, [key]: Boolean(value) };
  await setSystemConfig(FEATURE_FLAGS_CONFIG_ID, {
    flags,
    updatedAt: Date.now(),
    updatedBy,
  });
  return flags;
}
