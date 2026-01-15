import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertProjectSchema,
  insertSimulationSchema,
  insertRDIIParametersSchema,
  insertSSOEventSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  runGeneticAlgorithm,
  generateSyntheticObservedData,
  defaultGAConfig,
  type GAConfig,
  type ObservedData,
  type CalibrationResult,
} from "./genetic-algorithm";

const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".inp" || ext === ".rpt") {
      cb(null, true);
    } else {
      cb(new Error("Only .inp and .rpt files are allowed"));
    }
  },
});

const uploadICM = multer({
  dest: "uploads/icm/",
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".csv") {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are allowed for ICM import"));
    }
  },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Ensure uploads directory exists
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
  }

  // Dashboard Stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to get project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const project = await storage.createProject(parsed.data);
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Simulations
  app.get("/api/simulations", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const simulations = await storage.getSimulations(projectId);
      res.json(simulations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get simulations" });
    }
  });

  app.get("/api/simulations/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const simulations = await storage.getRecentSimulations(limit);
      res.json(simulations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent simulations" });
    }
  });

  app.get("/api/simulations/:id", async (req, res) => {
    try {
      const simulation = await storage.getSimulation(req.params.id);
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      res.json(simulation);
    } catch (error) {
      res.status(500).json({ error: "Failed to get simulation" });
    }
  });

  app.post("/api/simulations/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const projectId = req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }

      const simulation = await storage.createSimulation({
        projectId,
        name: req.file.originalname.replace(/\.[^/.]+$/, ""),
        inputFile: `/uploads/${req.file.filename}`,
      });
      res.status(201).json(simulation);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.post("/api/simulations/:id/run", async (req, res) => {
    try {
      const simulation = await storage.getSimulation(req.params.id);
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }

      // Start simulation (mock - in real implementation would use SWMM WASM)
      await storage.updateSimulation(req.params.id, {
        status: "running",
        progress: 0,
      });

      // Simulate progress updates
      let progress = 0;
      const interval = setInterval(async () => {
        progress += 10;
        if (progress >= 100) {
          clearInterval(interval);
          await storage.updateSimulation(req.params.id, {
            status: "completed",
            progress: 100,
            duration: Math.floor(Math.random() * 60) + 30,
            outputData: {
              totalInflow: 10 + Math.random() * 5,
              totalOutflow: 9.5 + Math.random() * 5,
              peakFlow: 6 + Math.random() * 4,
              peakTime: new Date().toISOString(),
              overflowVolume: Math.random() * 0.5,
              overflowCount: Math.floor(Math.random() * 5),
              nodeResults: [
                { id: "N1", name: "MH-101", type: "junction", maxDepth: 3 + Math.random() * 2, maxHGL: 100 + Math.random() * 5, timeSurcharged: Math.random(), timeFlooded: 0, floodVolume: 0 },
                { id: "N2", name: "MH-102", type: "junction", maxDepth: 4 + Math.random() * 2, maxHGL: 99 + Math.random() * 5, timeSurcharged: Math.random() * 2, timeFlooded: Math.random() * 0.2, floodVolume: Math.random() * 0.1 },
              ],
              linkResults: [
                { id: "L1", name: "C-101", type: "conduit", maxFlow: 4 + Math.random() * 3, maxVelocity: 3 + Math.random() * 2, maxDepth: 1.5 + Math.random(), capacityLimited: Math.random() * 0.5 },
              ],
            },
          });
        } else {
          await storage.updateSimulation(req.params.id, { progress });
        }
      }, 500);

      res.json({ message: "Simulation started" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start simulation" });
    }
  });

  app.post("/api/simulations/:id/stop", async (req, res) => {
    try {
      const simulation = await storage.updateSimulation(req.params.id, {
        status: "failed",
      });
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      res.json({ message: "Simulation stopped" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop simulation" });
    }
  });

  app.delete("/api/simulations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSimulation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete simulation" });
    }
  });

  // ICM InfoWorks Import
  if (!fs.existsSync("uploads/icm")) {
    fs.mkdirSync("uploads/icm", { recursive: true });
  }

  app.post("/api/import/icm", uploadICM.array("files", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const projectId = req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }

      const importResults: { filename: string; type: string; recordCount: number; status: string }[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file.path, "utf-8");
        const lines = content.split("\n").filter(line => line.trim());
        
        let dataType = "unknown";
        let recordCount = 0;

        if (lines.length > 0) {
          const header = lines[0].toLowerCase();
          if (header.includes("node") || header.includes("manhole") || header.includes("junction")) {
            dataType = "nodes";
            recordCount = lines.length - 1;
          } else if (header.includes("conduit") || header.includes("pipe") || header.includes("link")) {
            dataType = "conduits";
            recordCount = lines.length - 1;
          } else if (header.includes("subcatchment") || header.includes("catchment")) {
            dataType = "subcatchments";
            recordCount = lines.length - 1;
          } else if (header.includes("flow") || header.includes("hydrograph")) {
            dataType = "flow_data";
            recordCount = lines.length - 1;
          } else {
            dataType = "network_data";
            recordCount = lines.length - 1;
          }
        }

        importResults.push({
          filename: file.originalname,
          type: dataType,
          recordCount,
          status: "imported",
        });

        fs.renameSync(file.path, `uploads/icm/${projectId}_${file.originalname}`);
      }

      const simulation = await storage.createSimulation({
        projectId,
        name: `ICM Import - ${new Date().toLocaleDateString()}`,
        inputFile: `/uploads/icm/${projectId}_${files[0].originalname}`,
      });

      res.status(201).json({
        message: "ICM InfoWorks data imported successfully",
        simulation,
        importResults,
        totalFiles: files.length,
        totalRecords: importResults.reduce((sum, r) => sum + r.recordCount, 0),
      });
    } catch (error) {
      console.error("ICM import error:", error);
      res.status(500).json({ error: "Failed to import ICM data" });
    }
  });

  app.get("/api/import/icm/formats", (req, res) => {
    res.json({
      supportedFormats: [
        {
          name: "Node Data",
          description: "Manholes, junctions, and other network nodes",
          requiredColumns: ["node_id", "x", "y", "ground_level"],
          optionalColumns: ["invert_level", "chamber_depth", "cover_level"],
        },
        {
          name: "Conduit Data",
          description: "Pipes, channels, and other network links",
          requiredColumns: ["link_id", "us_node_id", "ds_node_id", "conduit_type"],
          optionalColumns: ["diameter", "length", "roughness", "gradient"],
        },
        {
          name: "Subcatchment Data",
          description: "Contributing drainage areas",
          requiredColumns: ["subcatchment_id", "area", "node_id"],
          optionalColumns: ["imperviousness", "width", "slope"],
        },
        {
          name: "Flow Data",
          description: "Time series flow measurements",
          requiredColumns: ["timestamp", "flow"],
          optionalColumns: ["node_id", "quality"],
        },
      ],
      exportInstructions: [
        "In ICM InfoWorks, right-click on your network in the Explorer Window",
        "Select 'Export > to CSV'",
        "Enable 'Include Database Field Names' option",
        "Select 'Use InfoWorks Native Units' for best compatibility",
        "Export each table (nodes, conduits, subcatchments) to separate CSV files",
      ],
    });
  });

  // RDII Parameters
  app.get("/api/rdii-parameters", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }
      const params = await storage.getRDIIParameters(projectId);
      res.json(params);
    } catch (error) {
      res.status(500).json({ error: "Failed to get RDII parameters" });
    }
  });

  app.get("/api/rdii-parameters/:id", async (req, res) => {
    try {
      const params = await storage.getRDIIParameter(req.params.id);
      if (!params) {
        return res.status(404).json({ error: "RDII parameters not found" });
      }
      res.json(params);
    } catch (error) {
      res.status(500).json({ error: "Failed to get RDII parameters" });
    }
  });

  app.post("/api/rdii-parameters", async (req, res) => {
    try {
      const parsed = insertRDIIParametersSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const params = await storage.createRDIIParameters(parsed.data);
      res.status(201).json(params);
    } catch (error) {
      res.status(500).json({ error: "Failed to create RDII parameters" });
    }
  });

  app.patch("/api/rdii-parameters/:id", async (req, res) => {
    try {
      const params = await storage.updateRDIIParameters(req.params.id, req.body);
      if (!params) {
        return res.status(404).json({ error: "RDII parameters not found" });
      }
      res.json(params);
    } catch (error) {
      res.status(500).json({ error: "Failed to update RDII parameters" });
    }
  });

  app.delete("/api/rdii-parameters/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRDIIParameters(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "RDII parameters not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete RDII parameters" });
    }
  });

  // GA Calibration for RDII
  app.get("/api/calibration/config", (req, res) => {
    res.json(defaultGAConfig);
  });

  app.post("/api/calibration/run", async (req, res) => {
    try {
      const { rdiiParameterId, gaConfig, observedData } = req.body;
      
      if (!rdiiParameterId) {
        return res.status(400).json({ error: "RDII Parameter ID required" });
      }

      const rdiiParams = await storage.getRDIIParameter(rdiiParameterId);
      if (!rdiiParams) {
        return res.status(404).json({ error: "RDII parameters not found" });
      }

      const config: GAConfig = gaConfig || defaultGAConfig;
      
      let observed: ObservedData;
      if (observedData && observedData.flows && observedData.rainfall && observedData.flows.length > 0) {
        observed = {
          timestamps: observedData.timestamps || observedData.flows.map((_: unknown, i: number) => i),
          flows: observedData.flows,
          rainfall: observedData.rainfall,
        };
      } else {
        const sampleRainfall = Array(96).fill(0).map((_, i) => {
          if (i >= 10 && i <= 16) return 0.1 + Math.random() * 0.05;
          if (i >= 40 && i <= 48) return 0.08 + Math.random() * 0.04;
          return 0;
        });
        
        const targetParams = {
          r1: Math.max(0.001, rdiiParams.r1 * (0.8 + Math.random() * 0.4)),
          t1: Math.max(0.5, rdiiParams.t1 * (0.9 + Math.random() * 0.2)),
          k1: Math.max(1.5, rdiiParams.k1 * (0.9 + Math.random() * 0.2)),
          r2: Math.max(0.001, rdiiParams.r2 * (0.8 + Math.random() * 0.4)),
          t2: Math.max(2, rdiiParams.t2 * (0.9 + Math.random() * 0.2)),
          k2: Math.max(2, rdiiParams.k2 * (0.9 + Math.random() * 0.2)),
          r3: Math.max(0.001, rdiiParams.r3 * (0.8 + Math.random() * 0.4)),
          t3: Math.max(6, rdiiParams.t3 * (0.9 + Math.random() * 0.2)),
          k3: Math.max(2, rdiiParams.k3 * (0.9 + Math.random() * 0.2)),
        };
        
        observed = generateSyntheticObservedData(targetParams, sampleRainfall, rdiiParams.area, 0.05);
      }

      const result = runGeneticAlgorithm(config, observed, rdiiParams.area);
      
      res.json({
        success: true,
        result,
        originalParameters: {
          r1: rdiiParams.r1, t1: rdiiParams.t1, k1: rdiiParams.k1,
          r2: rdiiParams.r2, t2: rdiiParams.t2, k2: rdiiParams.k2,
          r3: rdiiParams.r3, t3: rdiiParams.t3, k3: rdiiParams.k3,
        },
      });
    } catch (error) {
      console.error("Calibration error:", error);
      res.status(500).json({ error: "Failed to run calibration" });
    }
  });

  app.post("/api/calibration/apply", async (req, res) => {
    try {
      const { rdiiParameterId, optimizedParameters } = req.body;
      
      if (!rdiiParameterId || !optimizedParameters) {
        return res.status(400).json({ error: "RDII Parameter ID and optimized parameters required" });
      }

      const updated = await storage.updateRDIIParameters(rdiiParameterId, {
        r1: optimizedParameters.r1,
        t1: optimizedParameters.t1,
        k1: optimizedParameters.k1,
        r2: optimizedParameters.r2,
        t2: optimizedParameters.t2,
        k2: optimizedParameters.k2,
        r3: optimizedParameters.r3,
        t3: optimizedParameters.t3,
        k3: optimizedParameters.k3,
      });

      if (!updated) {
        return res.status(404).json({ error: "RDII parameters not found" });
      }

      res.json({ success: true, updatedParameters: updated });
    } catch (error) {
      console.error("Apply calibration error:", error);
      res.status(500).json({ error: "Failed to apply calibration" });
    }
  });

  // Hydrographs
  app.get("/api/hydrographs", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const sewershedId = req.query.sewershedId as string | undefined;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }
      const hydrographs = await storage.getHydrographs(projectId, sewershedId);
      res.json(hydrographs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get hydrographs" });
    }
  });

  app.get("/api/hydrographs/:id", async (req, res) => {
    try {
      const hydrograph = await storage.getHydrograph(req.params.id);
      if (!hydrograph) {
        return res.status(404).json({ error: "Hydrograph not found" });
      }
      res.json(hydrograph);
    } catch (error) {
      res.status(500).json({ error: "Failed to get hydrograph" });
    }
  });

  // Rainfall Data
  app.get("/api/rainfall", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }
      const rainfall = await storage.getRainfallData(projectId);
      res.json(rainfall || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get rainfall data" });
    }
  });

  // Condition Assessments
  app.get("/api/condition-assessments", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }
      const assessments = await storage.getConditionAssessments(projectId);
      res.json(assessments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get condition assessments" });
    }
  });

  app.get("/api/condition-assessments/:id", async (req, res) => {
    try {
      const assessment = await storage.getConditionAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ error: "Condition assessment not found" });
      }
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: "Failed to get condition assessment" });
    }
  });

  app.patch("/api/condition-assessments/:id", async (req, res) => {
    try {
      const assessment = await storage.updateConditionAssessment(req.params.id, req.body);
      if (!assessment) {
        return res.status(404).json({ error: "Condition assessment not found" });
      }
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update condition assessment" });
    }
  });

  // SSO Events
  app.get("/api/sso-events", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }
      const events = await storage.getSSOEvents(projectId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to get SSO events" });
    }
  });

  app.get("/api/sso-events/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const events = await storage.getRecentSSOEvents(limit);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent SSO events" });
    }
  });

  app.post("/api/sso-events", async (req, res) => {
    try {
      const parsed = insertSSOEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const event = await storage.createSSOEvent(parsed.data);
      res.status(201).json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to create SSO event" });
    }
  });

  app.delete("/api/sso-events/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSSOEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "SSO event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SSO event" });
    }
  });

  return httpServer;
}
