import { getDb } from "@/lib/mongodb";

export interface WorkspaceSettings {
  settingsId: string;
  openaiModel: string;
  mockAiOutputs: boolean;
  newsSearchProvider: "tavily";
  updatedAt: Date;
}

function settingsCollection() {
  return getDb().then((db) => db.collection<WorkspaceSettings>("workspace_settings"));
}

const SETTINGS_ID = "default";

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  const collection = await settingsCollection();
  const settings = await collection.findOne({ settingsId: SETTINGS_ID });
  if (settings) return settings;
  return {
    settingsId: SETTINGS_ID,
    openaiModel: "gpt-4o",
    mockAiOutputs: false,
    newsSearchProvider: "tavily",
    updatedAt: new Date(),
  };
}

const DEFAULT_SETTINGS: Omit<WorkspaceSettings, "settingsId" | "updatedAt"> = {
  openaiModel: "gpt-4o",
  mockAiOutputs: false,
  newsSearchProvider: "tavily",
};

export async function updateWorkspaceSettings(
  updates: Partial<Omit<WorkspaceSettings, "settingsId" | "updatedAt">>
): Promise<WorkspaceSettings> {
  const collection = await settingsCollection();
  const existing = await collection.findOne({ settingsId: SETTINGS_ID });
  if (existing) {
    await collection.updateOne(
      { settingsId: SETTINGS_ID },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  } else {
    await collection.insertOne({
      settingsId: SETTINGS_ID,
      ...DEFAULT_SETTINGS,
      ...updates,
      updatedAt: new Date(),
    });
  }
  return getWorkspaceSettings();
}
