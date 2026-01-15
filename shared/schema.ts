import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// SSOAP Project Schema
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed" | "archived";
  sewershedCount: number;
  totalArea: number; // acres
}

export interface InsertProject {
  name: string;
  description: string;
  sewershedCount?: number;
  totalArea?: number;
}

// SWMM Simulation Schema
export interface Simulation {
  id: string;
  projectId: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  inputFile: string;
  outputData: SimulationOutput | null;
  createdAt: string;
  duration: number; // seconds
  progress: number; // 0-100
}

export interface InsertSimulation {
  projectId: string;
  name: string;
  inputFile: string;
}

export interface SimulationOutput {
  totalInflow: number;
  totalOutflow: number;
  peakFlow: number;
  peakTime: string;
  overflowVolume: number;
  overflowCount: number;
  nodeResults: NodeResult[];
  linkResults: LinkResult[];
}

export interface NodeResult {
  id: string;
  name: string;
  type: "junction" | "outfall" | "storage" | "divider";
  maxDepth: number;
  maxHGL: number;
  timeSurcharged: number;
  timeFlooded: number;
  floodVolume: number;
}

export interface LinkResult {
  id: string;
  name: string;
  type: "conduit" | "pump" | "orifice" | "weir";
  maxFlow: number;
  maxVelocity: number;
  maxDepth: number;
  capacityLimited: number; // hours
}

// RDII Parameters (RTK Method)
export interface RDIIParameters {
  id: string;
  projectId: string;
  sewershedId: string;
  sewershedName: string;
  area: number; // acres
  // R values - fraction of rainfall entering sewer
  r1: number;
  r2: number;
  r3: number;
  // T values - time to peak (hours)
  t1: number;
  t2: number;
  t3: number;
  // K values - ratio of recession to time to peak
  k1: number;
  k2: number;
  k3: number;
  // Computed metrics
  totalR: number;
  dominantResponse: "inflow" | "infiltration" | "balanced";
  createdAt: string;
}

export interface InsertRDIIParameters {
  projectId: string;
  sewershedId: string;
  sewershedName: string;
  area: number;
  r1: number;
  r2: number;
  r3: number;
  t1: number;
  t2: number;
  t3: number;
  k1: number;
  k2: number;
  k3: number;
}

// Hydrograph Data
export interface Hydrograph {
  id: string;
  projectId: string;
  sewershedId: string;
  name: string;
  type: "observed" | "simulated" | "rdii" | "dwf";
  startTime: string;
  endTime: string;
  interval: number; // minutes
  data: HydrographPoint[];
  peakFlow: number;
  totalVolume: number;
}

export interface HydrographPoint {
  time: string;
  flow: number;
  rainfall?: number;
}

export interface InsertHydrograph {
  projectId: string;
  sewershedId: string;
  name: string;
  type: "observed" | "simulated" | "rdii" | "dwf";
  startTime: string;
  endTime: string;
  interval: number;
  data: HydrographPoint[];
}

// Condition Assessment
export interface ConditionAssessment {
  id: string;
  projectId: string;
  sewershedId: string;
  sewershedName: string;
  preRehabRDII: RDIIParameters | null;
  postRehabRDII: RDIIParameters | null;
  rdiiReduction: number; // percentage
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "completed";
  notes: string;
  assessmentDate: string;
}

export interface InsertConditionAssessment {
  projectId: string;
  sewershedId: string;
  sewershedName: string;
  priority: "high" | "medium" | "low";
  notes?: string;
}

// Flow Monitoring Data
export interface FlowMonitoringData {
  id: string;
  projectId: string;
  stationId: string;
  stationName: string;
  data: FlowDataPoint[];
  startDate: string;
  endDate: string;
}

export interface FlowDataPoint {
  timestamp: string;
  flow: number;
  depth?: number;
  velocity?: number;
}

// Rainfall Data
export interface RainfallData {
  id: string;
  projectId: string;
  gaugeId: string;
  gaugeName: string;
  data: RainfallPoint[];
  startDate: string;
  endDate: string;
  totalRainfall: number;
}

export interface RainfallPoint {
  timestamp: string;
  intensity: number; // inches/hour
  cumulative: number;
}

// SSO Event
export interface SSOEvent {
  id: string;
  projectId: string;
  location: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  volume: number; // gallons
  cause: "rainfall" | "blockage" | "capacity" | "pump_failure" | "other";
  severity: "minor" | "moderate" | "major";
}

export interface InsertSSOEvent {
  projectId: string;
  location: string;
  startTime: string;
  endTime: string;
  volume: number;
  cause: "rainfall" | "blockage" | "capacity" | "pump_failure" | "other";
  severity: "minor" | "moderate" | "major";
}

// Zod schemas for validation
export const insertProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string(),
  sewershedCount: z.number().optional(),
  totalArea: z.number().optional(),
});

export const insertSimulationSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1, "Simulation name is required"),
  inputFile: z.string(),
});

export const insertRDIIParametersSchema = z.object({
  projectId: z.string(),
  sewershedId: z.string(),
  sewershedName: z.string(),
  area: z.number().positive(),
  r1: z.number().min(0).max(1),
  r2: z.number().min(0).max(1),
  r3: z.number().min(0).max(1),
  t1: z.number().positive(),
  t2: z.number().positive(),
  t3: z.number().positive(),
  k1: z.number().positive(),
  k2: z.number().positive(),
  k3: z.number().positive(),
});

export const insertSSOEventSchema = z.object({
  projectId: z.string(),
  location: z.string().min(1),
  startTime: z.string(),
  endTime: z.string(),
  volume: z.number().positive(),
  cause: z.enum(["rainfall", "blockage", "capacity", "pump_failure", "other"]),
  severity: z.enum(["minor", "moderate", "major"]),
});
