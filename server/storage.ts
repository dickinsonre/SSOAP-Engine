import { randomUUID } from "crypto";
import type {
  User,
  InsertUser,
  Project,
  InsertProject,
  Simulation,
  InsertSimulation,
  RDIIParameters,
  InsertRDIIParameters,
  Hydrograph,
  InsertHydrograph,
  ConditionAssessment,
  InsertConditionAssessment,
  SSOEvent,
  InsertSSOEvent,
  RainfallData,
  SimulationOutput,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Simulations
  getSimulations(projectId?: string): Promise<Simulation[]>;
  getSimulation(id: string): Promise<Simulation | undefined>;
  getRecentSimulations(limit?: number): Promise<Simulation[]>;
  createSimulation(simulation: InsertSimulation): Promise<Simulation>;
  updateSimulation(id: string, updates: Partial<Simulation>): Promise<Simulation | undefined>;
  deleteSimulation(id: string): Promise<boolean>;

  // RDII Parameters
  getRDIIParameters(projectId: string): Promise<RDIIParameters[]>;
  getRDIIParameter(id: string): Promise<RDIIParameters | undefined>;
  createRDIIParameters(params: InsertRDIIParameters): Promise<RDIIParameters>;
  updateRDIIParameters(id: string, params: Partial<InsertRDIIParameters>): Promise<RDIIParameters | undefined>;
  deleteRDIIParameters(id: string): Promise<boolean>;

  // Hydrographs
  getHydrographs(projectId: string, sewershedId?: string): Promise<Hydrograph[]>;
  getHydrograph(id: string): Promise<Hydrograph | undefined>;
  createHydrograph(hydrograph: InsertHydrograph): Promise<Hydrograph>;
  deleteHydrograph(id: string): Promise<boolean>;

  // Condition Assessments
  getConditionAssessments(projectId: string): Promise<ConditionAssessment[]>;
  getConditionAssessment(id: string): Promise<ConditionAssessment | undefined>;
  createConditionAssessment(assessment: InsertConditionAssessment): Promise<ConditionAssessment>;
  updateConditionAssessment(id: string, updates: Partial<ConditionAssessment>): Promise<ConditionAssessment | undefined>;
  deleteConditionAssessment(id: string): Promise<boolean>;

  // SSO Events
  getSSOEvents(projectId: string): Promise<SSOEvent[]>;
  getRecentSSOEvents(limit?: number): Promise<SSOEvent[]>;
  getSSOEvent(id: string): Promise<SSOEvent | undefined>;
  createSSOEvent(event: InsertSSOEvent): Promise<SSOEvent>;
  deleteSSOEvent(id: string): Promise<boolean>;

  // Rainfall Data
  getRainfallData(projectId: string): Promise<RainfallData | undefined>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalProjects: number;
    activeSimulations: number;
    totalSSOEvents: number;
    averageRDII: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private simulations: Map<string, Simulation>;
  private rdiiParameters: Map<string, RDIIParameters>;
  private hydrographs: Map<string, Hydrograph>;
  private conditionAssessments: Map<string, ConditionAssessment>;
  private ssoEvents: Map<string, SSOEvent>;
  private rainfallData: Map<string, RainfallData>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.simulations = new Map();
    this.rdiiParameters = new Map();
    this.hydrographs = new Map();
    this.conditionAssessments = new Map();
    this.ssoEvents = new Map();
    this.rainfallData = new Map();

    this.seedDemoData();
  }

  private seedDemoData() {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    const project1: Project = {
      id: "proj-1",
      name: "Downtown Sewer Analysis",
      description: "Capacity analysis for downtown sanitary sewer system including RDII assessment",
      createdAt: yesterday,
      updatedAt: now,
      status: "active",
      sewershedCount: 12,
      totalArea: 2450,
    };

    const project2: Project = {
      id: "proj-2",
      name: "Northside Rehabilitation",
      description: "Post-rehabilitation performance assessment for northside sewersheds",
      createdAt: yesterday,
      updatedAt: now,
      status: "active",
      sewershedCount: 8,
      totalArea: 1850,
    };

    this.projects.set(project1.id, project1);
    this.projects.set(project2.id, project2);

    const sim1: Simulation = {
      id: "sim-1",
      projectId: "proj-1",
      name: "Baseline Simulation",
      status: "completed",
      inputFile: "/uploads/downtown_baseline.inp",
      createdAt: yesterday,
      duration: 45,
      progress: 100,
      outputData: {
        totalInflow: 12.5,
        totalOutflow: 12.3,
        peakFlow: 8.7,
        peakTime: "2024-03-15 14:30",
        overflowVolume: 0.15,
        overflowCount: 2,
        nodeResults: [
          { id: "N1", name: "MH-101", type: "junction", maxDepth: 4.2, maxHGL: 102.5, timeSurcharged: 0.5, timeFlooded: 0, floodVolume: 0 },
          { id: "N2", name: "MH-102", type: "junction", maxDepth: 5.1, maxHGL: 101.8, timeSurcharged: 1.2, timeFlooded: 0.1, floodVolume: 0.02 },
          { id: "N3", name: "OUT-1", type: "outfall", maxDepth: 2.5, maxHGL: 98.0, timeSurcharged: 0, timeFlooded: 0, floodVolume: 0 },
        ],
        linkResults: [
          { id: "L1", name: "C-101", type: "conduit", maxFlow: 5.2, maxVelocity: 4.5, maxDepth: 1.8, capacityLimited: 0.3 },
          { id: "L2", name: "C-102", type: "conduit", maxFlow: 7.8, maxVelocity: 5.1, maxDepth: 2.1, capacityLimited: 0.8 },
        ],
      },
    };

    const sim2: Simulation = {
      id: "sim-2",
      projectId: "proj-1",
      name: "Storm Event Analysis",
      status: "running",
      inputFile: "/uploads/downtown_storm.inp",
      createdAt: now,
      duration: 0,
      progress: 65,
      outputData: null,
    };

    this.simulations.set(sim1.id, sim1);
    this.simulations.set(sim2.id, sim2);

    const rdii1: RDIIParameters = {
      id: "rdii-1",
      projectId: "proj-1",
      sewershedId: "sw-1",
      sewershedName: "Downtown Core",
      area: 450,
      r1: 0.08,
      r2: 0.04,
      r3: 0.02,
      t1: 1.5,
      t2: 6.0,
      t3: 24.0,
      k1: 2.5,
      k2: 3.0,
      k3: 4.0,
      totalR: 0.14,
      dominantResponse: "inflow",
      createdAt: yesterday,
    };

    const rdii2: RDIIParameters = {
      id: "rdii-2",
      projectId: "proj-1",
      sewershedId: "sw-2",
      sewershedName: "Commercial District",
      area: 680,
      r1: 0.05,
      r2: 0.06,
      r3: 0.04,
      t1: 2.0,
      t2: 8.0,
      t3: 36.0,
      k1: 2.0,
      k2: 3.5,
      k3: 4.5,
      totalR: 0.15,
      dominantResponse: "infiltration",
      createdAt: yesterday,
    };

    const rdii3: RDIIParameters = {
      id: "rdii-3",
      projectId: "proj-1",
      sewershedId: "sw-3",
      sewershedName: "Residential North",
      area: 520,
      r1: 0.06,
      r2: 0.05,
      r3: 0.05,
      t1: 1.8,
      t2: 7.0,
      t3: 30.0,
      k1: 2.2,
      k2: 3.2,
      k3: 4.2,
      totalR: 0.16,
      dominantResponse: "balanced",
      createdAt: yesterday,
    };

    this.rdiiParameters.set(rdii1.id, rdii1);
    this.rdiiParameters.set(rdii2.id, rdii2);
    this.rdiiParameters.set(rdii3.id, rdii3);

    const generateHydrographData = (startTime: Date, hours: number, baseFlow: number, peakHour: number, peakFlow: number) => {
      const data = [];
      for (let h = 0; h < hours; h++) {
        const time = new Date(startTime.getTime() + h * 3600000).toISOString();
        let flow = baseFlow;
        if (h >= peakHour - 2 && h <= peakHour + 2) {
          const dist = Math.abs(h - peakHour);
          flow = baseFlow + (peakFlow - baseFlow) * (1 - dist / 2);
        }
        data.push({ time, flow: flow + Math.random() * 0.5 });
      }
      return data;
    };

    const hydrograph1: Hydrograph = {
      id: "hydro-1",
      projectId: "proj-1",
      sewershedId: "sw-1",
      name: "March 2024 Storm Event - Observed",
      type: "observed",
      startTime: "2024-03-15T00:00:00Z",
      endTime: "2024-03-16T00:00:00Z",
      interval: 15,
      data: generateHydrographData(new Date("2024-03-15T00:00:00Z"), 24, 2.5, 14, 8.5),
      peakFlow: 8.5,
      totalVolume: 4.2,
    };

    const hydrograph2: Hydrograph = {
      id: "hydro-2",
      projectId: "proj-1",
      sewershedId: "sw-1",
      name: "March 2024 Storm Event - Simulated",
      type: "simulated",
      startTime: "2024-03-15T00:00:00Z",
      endTime: "2024-03-16T00:00:00Z",
      interval: 15,
      data: generateHydrographData(new Date("2024-03-15T00:00:00Z"), 24, 2.4, 14, 8.2),
      peakFlow: 8.2,
      totalVolume: 4.0,
    };

    this.hydrographs.set(hydrograph1.id, hydrograph1);
    this.hydrographs.set(hydrograph2.id, hydrograph2);

    const assessment1: ConditionAssessment = {
      id: "assess-1",
      projectId: "proj-2",
      sewershedId: "sw-n1",
      sewershedName: "Northside Sector A",
      preRehabRDII: {
        id: "pre-1",
        projectId: "proj-2",
        sewershedId: "sw-n1",
        sewershedName: "Northside Sector A",
        area: 380,
        r1: 0.12,
        r2: 0.08,
        r3: 0.05,
        t1: 1.5,
        t2: 6.0,
        t3: 24.0,
        k1: 2.5,
        k2: 3.0,
        k3: 4.0,
        totalR: 0.25,
        dominantResponse: "inflow",
        createdAt: yesterday,
      },
      postRehabRDII: {
        id: "post-1",
        projectId: "proj-2",
        sewershedId: "sw-n1",
        sewershedName: "Northside Sector A",
        area: 380,
        r1: 0.06,
        r2: 0.04,
        r3: 0.02,
        t1: 1.5,
        t2: 6.0,
        t3: 24.0,
        k1: 2.5,
        k2: 3.0,
        k3: 4.0,
        totalR: 0.12,
        dominantResponse: "inflow",
        createdAt: now,
      },
      rdiiReduction: 52,
      priority: "high",
      status: "completed",
      notes: "Successful rehabilitation. Point repairs at 3 locations significantly reduced inflow.",
      assessmentDate: now,
    };

    const assessment2: ConditionAssessment = {
      id: "assess-2",
      projectId: "proj-2",
      sewershedId: "sw-n2",
      sewershedName: "Northside Sector B",
      preRehabRDII: {
        id: "pre-2",
        projectId: "proj-2",
        sewershedId: "sw-n2",
        sewershedName: "Northside Sector B",
        area: 420,
        r1: 0.09,
        r2: 0.07,
        r3: 0.06,
        t1: 1.8,
        t2: 7.0,
        t3: 28.0,
        k1: 2.2,
        k2: 3.2,
        k3: 4.2,
        totalR: 0.22,
        dominantResponse: "infiltration",
        createdAt: yesterday,
      },
      postRehabRDII: null,
      rdiiReduction: 0,
      priority: "medium",
      status: "in-progress",
      notes: "Rehabilitation in progress. CIPP lining scheduled for Q2.",
      assessmentDate: now,
    };

    this.conditionAssessments.set(assessment1.id, assessment1);
    this.conditionAssessments.set(assessment2.id, assessment2);

    const event1: SSOEvent = {
      id: "sso-1",
      projectId: "proj-1",
      location: "MH-102 (Main St & 5th Ave)",
      startTime: "2024-03-15T13:45:00Z",
      endTime: "2024-03-15T14:30:00Z",
      duration: 45,
      volume: 2500,
      cause: "rainfall",
      severity: "moderate",
    };

    const event2: SSOEvent = {
      id: "sso-2",
      projectId: "proj-1",
      location: "MH-215 (Oak Street)",
      startTime: "2024-02-28T09:15:00Z",
      endTime: "2024-02-28T09:45:00Z",
      duration: 30,
      volume: 850,
      cause: "blockage",
      severity: "minor",
    };

    const event3: SSOEvent = {
      id: "sso-3",
      projectId: "proj-1",
      location: "PS-3 (Riverside Pump Station)",
      startTime: "2024-01-15T02:30:00Z",
      endTime: "2024-01-15T05:00:00Z",
      duration: 150,
      volume: 15000,
      cause: "pump_failure",
      severity: "major",
    };

    this.ssoEvents.set(event1.id, event1);
    this.ssoEvents.set(event2.id, event2);
    this.ssoEvents.set(event3.id, event3);

    const rainfall: RainfallData = {
      id: "rain-1",
      projectId: "proj-1",
      gaugeId: "RG-1",
      gaugeName: "Downtown Rain Gauge",
      startDate: "2024-03-15T00:00:00Z",
      endDate: "2024-03-16T00:00:00Z",
      totalRainfall: 2.4,
      data: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(new Date("2024-03-15").getTime() + i * 3600000).toISOString(),
        intensity: i >= 12 && i <= 16 ? 0.3 + Math.random() * 0.4 : 0.05 + Math.random() * 0.1,
        cumulative: 0,
      })),
    };
    let cumulative = 0;
    rainfall.data.forEach((d) => {
      cumulative += d.intensity;
      d.cumulative = cumulative;
    });

    this.rainfallData.set("proj-1", rainfall);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name: insertProject.name,
      description: insertProject.description,
      createdAt: now,
      updatedAt: now,
      status: "active",
      sewershedCount: insertProject.sewershedCount || 0,
      totalArea: insertProject.totalArea || 0,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updated: Project = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Simulations
  async getSimulations(projectId?: string): Promise<Simulation[]> {
    const sims = Array.from(this.simulations.values());
    if (projectId) {
      return sims.filter((s) => s.projectId === projectId);
    }
    return sims;
  }

  async getSimulation(id: string): Promise<Simulation | undefined> {
    return this.simulations.get(id);
  }

  async getRecentSimulations(limit = 10): Promise<Simulation[]> {
    return Array.from(this.simulations.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createSimulation(insert: InsertSimulation): Promise<Simulation> {
    const id = randomUUID();
    const simulation: Simulation = {
      id,
      projectId: insert.projectId,
      name: insert.name,
      status: "pending",
      inputFile: insert.inputFile,
      createdAt: new Date().toISOString(),
      duration: 0,
      progress: 0,
      outputData: null,
    };
    this.simulations.set(id, simulation);
    return simulation;
  }

  async updateSimulation(id: string, updates: Partial<Simulation>): Promise<Simulation | undefined> {
    const sim = this.simulations.get(id);
    if (!sim) return undefined;

    const updated = { ...sim, ...updates };
    this.simulations.set(id, updated);
    return updated;
  }

  async deleteSimulation(id: string): Promise<boolean> {
    return this.simulations.delete(id);
  }

  // RDII Parameters
  async getRDIIParameters(projectId: string): Promise<RDIIParameters[]> {
    return Array.from(this.rdiiParameters.values()).filter((p) => p.projectId === projectId);
  }

  async getRDIIParameter(id: string): Promise<RDIIParameters | undefined> {
    return this.rdiiParameters.get(id);
  }

  async createRDIIParameters(insert: InsertRDIIParameters): Promise<RDIIParameters> {
    const id = randomUUID();
    const totalR = insert.r1 + insert.r2 + insert.r3;
    let dominantResponse: "inflow" | "infiltration" | "balanced" = "balanced";
    if (insert.r1 > insert.r2 + insert.r3) dominantResponse = "inflow";
    else if (insert.r3 > insert.r1 + insert.r2) dominantResponse = "infiltration";

    const params: RDIIParameters = {
      id,
      ...insert,
      totalR,
      dominantResponse,
      createdAt: new Date().toISOString(),
    };
    this.rdiiParameters.set(id, params);
    return params;
  }

  async updateRDIIParameters(id: string, updates: Partial<InsertRDIIParameters>): Promise<RDIIParameters | undefined> {
    const params = this.rdiiParameters.get(id);
    if (!params) return undefined;

    const updated = { ...params, ...updates };
    updated.totalR = updated.r1 + updated.r2 + updated.r3;
    if (updated.r1 > updated.r2 + updated.r3) updated.dominantResponse = "inflow";
    else if (updated.r3 > updated.r1 + updated.r2) updated.dominantResponse = "infiltration";
    else updated.dominantResponse = "balanced";

    this.rdiiParameters.set(id, updated);
    return updated;
  }

  async deleteRDIIParameters(id: string): Promise<boolean> {
    return this.rdiiParameters.delete(id);
  }

  // Hydrographs
  async getHydrographs(projectId: string, sewershedId?: string): Promise<Hydrograph[]> {
    let hydros = Array.from(this.hydrographs.values()).filter((h) => h.projectId === projectId);
    if (sewershedId) {
      hydros = hydros.filter((h) => h.sewershedId === sewershedId);
    }
    return hydros;
  }

  async getHydrograph(id: string): Promise<Hydrograph | undefined> {
    return this.hydrographs.get(id);
  }

  async createHydrograph(insert: InsertHydrograph): Promise<Hydrograph> {
    const id = randomUUID();
    const peakFlow = Math.max(...insert.data.map((d) => d.flow));
    const totalVolume = insert.data.reduce((sum, d) => sum + d.flow * (insert.interval / 60), 0);

    const hydrograph: Hydrograph = {
      id,
      ...insert,
      peakFlow,
      totalVolume,
    };
    this.hydrographs.set(id, hydrograph);
    return hydrograph;
  }

  async deleteHydrograph(id: string): Promise<boolean> {
    return this.hydrographs.delete(id);
  }

  // Condition Assessments
  async getConditionAssessments(projectId: string): Promise<ConditionAssessment[]> {
    return Array.from(this.conditionAssessments.values()).filter((a) => a.projectId === projectId);
  }

  async getConditionAssessment(id: string): Promise<ConditionAssessment | undefined> {
    return this.conditionAssessments.get(id);
  }

  async createConditionAssessment(insert: InsertConditionAssessment): Promise<ConditionAssessment> {
    const id = randomUUID();
    const assessment: ConditionAssessment = {
      id,
      projectId: insert.projectId,
      sewershedId: insert.sewershedId,
      sewershedName: insert.sewershedName,
      preRehabRDII: null,
      postRehabRDII: null,
      rdiiReduction: 0,
      priority: insert.priority,
      status: "pending",
      notes: insert.notes || "",
      assessmentDate: new Date().toISOString(),
    };
    this.conditionAssessments.set(id, assessment);
    return assessment;
  }

  async updateConditionAssessment(id: string, updates: Partial<ConditionAssessment>): Promise<ConditionAssessment | undefined> {
    const assessment = this.conditionAssessments.get(id);
    if (!assessment) return undefined;

    const updated = { ...assessment, ...updates };
    this.conditionAssessments.set(id, updated);
    return updated;
  }

  async deleteConditionAssessment(id: string): Promise<boolean> {
    return this.conditionAssessments.delete(id);
  }

  // SSO Events
  async getSSOEvents(projectId: string): Promise<SSOEvent[]> {
    return Array.from(this.ssoEvents.values())
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async getRecentSSOEvents(limit = 10): Promise<SSOEvent[]> {
    return Array.from(this.ssoEvents.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  async getSSOEvent(id: string): Promise<SSOEvent | undefined> {
    return this.ssoEvents.get(id);
  }

  async createSSOEvent(insert: InsertSSOEvent): Promise<SSOEvent> {
    const id = randomUUID();
    const start = new Date(insert.startTime);
    const end = new Date(insert.endTime);
    const duration = Math.round((end.getTime() - start.getTime()) / 60000);

    const event: SSOEvent = {
      id,
      ...insert,
      duration,
    };
    this.ssoEvents.set(id, event);
    return event;
  }

  async deleteSSOEvent(id: string): Promise<boolean> {
    return this.ssoEvents.delete(id);
  }

  // Rainfall Data
  async getRainfallData(projectId: string): Promise<RainfallData | undefined> {
    return this.rainfallData.get(projectId);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<{
    totalProjects: number;
    activeSimulations: number;
    totalSSOEvents: number;
    averageRDII: number;
  }> {
    const projects = Array.from(this.projects.values());
    const simulations = Array.from(this.simulations.values());
    const events = Array.from(this.ssoEvents.values());
    const rdii = Array.from(this.rdiiParameters.values());

    const avgRDII = rdii.length > 0 ? rdii.reduce((sum, r) => sum + r.totalR, 0) / rdii.length * 100 : 0;

    return {
      totalProjects: projects.length,
      activeSimulations: simulations.filter((s) => s.status === "running").length,
      totalSSOEvents: events.length,
      averageRDII: Math.round(avgRDII * 10) / 10,
    };
  }
}

export const storage = new MemStorage();
