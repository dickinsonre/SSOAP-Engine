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
