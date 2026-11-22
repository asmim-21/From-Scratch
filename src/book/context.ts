import { createContext, useContext } from 'react';
import type { Plan } from './plan';

/** The finished plan, so contents and index entries can show page numbers. */
export const PlanContext = createContext<Plan | null>(null);
export const usePlan = () => useContext(PlanContext);
