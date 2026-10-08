import { createContext, useContext } from 'react';

export interface ChartSaveEnvironment {
  canSave: boolean;
  projectId: string;
}
const ChartSaveContext = createContext<ChartSaveEnvironment>({ canSave: false, projectId: '' });
export const ChartSaveProvider = ChartSaveContext.Provider;
export function useChartSaveEnv(): ChartSaveEnvironment {
  return useContext(ChartSaveContext);
}
