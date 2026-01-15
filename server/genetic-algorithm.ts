export interface RTKParameters {
  r1: number;
  t1: number;
  k1: number;
  r2: number;
  t2: number;
  k2: number;
  r3: number;
  t3: number;
  k3: number;
}

export interface GAConfig {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  parameterRanges: {
    r1: { min: number; max: number };
    t1: { min: number; max: number };
    k1: { min: number; max: number };
    r2: { min: number; max: number };
    t2: { min: number; max: number };
    k2: { min: number; max: number };
    r3: { min: number; max: number };
    t3: { min: number; max: number };
    k3: { min: number; max: number };
  };
}

export interface ObservedData {
  timestamps: number[];
  flows: number[];
  rainfall: number[];
}

export interface Individual {
  genes: RTKParameters;
  fitness: number;
}

export interface GenerationResult {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  bestIndividual: RTKParameters;
}

export interface CalibrationResult {
  optimizedParameters: RTKParameters;
  finalFitness: number;
  generationHistory: GenerationResult[];
  simulatedFlow: number[];
  observedFlow: number[];
  timestamps: number[];
  statistics: {
    nashSutcliffe: number;
    rmse: number;
    correlationCoefficient: number;
    peakFlowError: number;
    volumeError: number;
  };
}

export const defaultGAConfig: GAConfig = {
  populationSize: 50,
  maxGenerations: 100,
  mutationRate: 0.1,
  crossoverRate: 0.8,
  eliteCount: 2,
  parameterRanges: {
    r1: { min: 0.0001, max: 0.2 },
    t1: { min: 0.5, max: 4 },
    k1: { min: 1.5, max: 4 },
    r2: { min: 0.0001, max: 0.15 },
    t2: { min: 2, max: 12 },
    k2: { min: 2, max: 6 },
    r3: { min: 0.0001, max: 0.1 },
    t3: { min: 6, max: 48 },
    k3: { min: 2, max: 8 },
  },
};

function generateTriangularUnitHydrograph(T: number, K: number, timeStep: number): number[] {
  const duration = T + T * K;
  const steps = Math.ceil(duration / timeStep);
  const hydrograph: number[] = [];
  
  for (let i = 0; i <= steps; i++) {
    const t = i * timeStep;
    let q = 0;
    
    if (t <= T) {
      q = t / T;
    } else if (t <= T + T * K) {
      q = 1 - (t - T) / (T * K);
    }
    
    hydrograph.push(Math.max(0, q));
  }
  
  const sum = hydrograph.reduce((a, b) => a + b, 0);
  return hydrograph.map(v => v / (sum || 1));
}

function convolve(rainfall: number[], unitHydrograph: number[]): number[] {
  const result: number[] = new Array(rainfall.length).fill(0);
  
  for (let i = 0; i < rainfall.length; i++) {
    for (let j = 0; j < unitHydrograph.length && i + j < result.length; j++) {
      result[i + j] += rainfall[i] * unitHydrograph[j];
    }
  }
  
  return result;
}

function simulateRDII(
  params: RTKParameters,
  rainfall: number[],
  area: number,
  timeStep: number = 1
): number[] {
  const uh1 = generateTriangularUnitHydrograph(params.t1, params.k1, timeStep);
  const uh2 = generateTriangularUnitHydrograph(params.t2, params.k2, timeStep);
  const uh3 = generateTriangularUnitHydrograph(params.t3, params.k3, timeStep);
  
  const rdii1 = convolve(rainfall.map(r => r * params.r1 * area), uh1);
  const rdii2 = convolve(rainfall.map(r => r * params.r2 * area), uh2);
  const rdii3 = convolve(rainfall.map(r => r * params.r3 * area), uh3);
  
  return rainfall.map((_, i) => 
    (rdii1[i] || 0) + (rdii2[i] || 0) + (rdii3[i] || 0)
  );
}

function calculateFitness(
  params: RTKParameters,
  observed: ObservedData,
  area: number
): number {
  const simulated = simulateRDII(params, observed.rainfall, area);
  
  let sumSquaredError = 0;
  let sumObserved = 0;
  let meanObserved = observed.flows.reduce((a, b) => a + b, 0) / observed.flows.length;
  let ssTot = 0;
  
  for (let i = 0; i < observed.flows.length; i++) {
    const error = (observed.flows[i] || 0) - (simulated[i] || 0);
    sumSquaredError += error * error;
    sumObserved += observed.flows[i] || 0;
    ssTot += Math.pow((observed.flows[i] || 0) - meanObserved, 2);
  }
  
  const nashSutcliffe = ssTot > 0 ? 1 - sumSquaredError / ssTot : 0;
  
  return Math.max(0, nashSutcliffe);
}

function createRandomIndividual(config: GAConfig): Individual {
  const genes: RTKParameters = {
    r1: config.parameterRanges.r1.min + Math.random() * (config.parameterRanges.r1.max - config.parameterRanges.r1.min),
    t1: config.parameterRanges.t1.min + Math.random() * (config.parameterRanges.t1.max - config.parameterRanges.t1.min),
    k1: config.parameterRanges.k1.min + Math.random() * (config.parameterRanges.k1.max - config.parameterRanges.k1.min),
    r2: config.parameterRanges.r2.min + Math.random() * (config.parameterRanges.r2.max - config.parameterRanges.r2.min),
    t2: config.parameterRanges.t2.min + Math.random() * (config.parameterRanges.t2.max - config.parameterRanges.t2.min),
    k2: config.parameterRanges.k2.min + Math.random() * (config.parameterRanges.k2.max - config.parameterRanges.k2.min),
    r3: config.parameterRanges.r3.min + Math.random() * (config.parameterRanges.r3.max - config.parameterRanges.r3.min),
    t3: config.parameterRanges.t3.min + Math.random() * (config.parameterRanges.t3.max - config.parameterRanges.t3.min),
    k3: config.parameterRanges.k3.min + Math.random() * (config.parameterRanges.k3.max - config.parameterRanges.k3.min),
  };
  return { genes, fitness: 0 };
}

function crossover(parent1: Individual, parent2: Individual, config: GAConfig): Individual {
  const genes: RTKParameters = {
    r1: Math.random() < 0.5 ? parent1.genes.r1 : parent2.genes.r1,
    t1: Math.random() < 0.5 ? parent1.genes.t1 : parent2.genes.t1,
    k1: Math.random() < 0.5 ? parent1.genes.k1 : parent2.genes.k1,
    r2: Math.random() < 0.5 ? parent1.genes.r2 : parent2.genes.r2,
    t2: Math.random() < 0.5 ? parent1.genes.t2 : parent2.genes.t2,
    k2: Math.random() < 0.5 ? parent1.genes.k2 : parent2.genes.k2,
    r3: Math.random() < 0.5 ? parent1.genes.r3 : parent2.genes.r3,
    t3: Math.random() < 0.5 ? parent1.genes.t3 : parent2.genes.t3,
    k3: Math.random() < 0.5 ? parent1.genes.k3 : parent2.genes.k3,
  };
  return { genes, fitness: 0 };
}

function mutate(individual: Individual, config: GAConfig): Individual {
  const genes = { ...individual.genes };
  const params = ['r1', 't1', 'k1', 'r2', 't2', 'k2', 'r3', 't3', 'k3'] as const;
  
  for (const param of params) {
    if (Math.random() < config.mutationRate) {
      const range = config.parameterRanges[param];
      const mutation = (Math.random() - 0.5) * 0.2 * (range.max - range.min);
      genes[param] = Math.max(range.min, Math.min(range.max, genes[param] + mutation));
    }
  }
  
  return { genes, fitness: 0 };
}

function tournamentSelection(population: Individual[], tournamentSize: number = 3): Individual {
  let best: Individual | null = null;
  
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }
  
  return best!;
}

export function runGeneticAlgorithm(
  config: GAConfig,
  observed: ObservedData,
  area: number,
  onProgress?: (result: GenerationResult) => void
): CalibrationResult {
  let population: Individual[] = [];
  for (let i = 0; i < config.populationSize; i++) {
    population.push(createRandomIndividual(config));
  }
  
  population.forEach(ind => {
    ind.fitness = calculateFitness(ind.genes, observed, area);
  });
  
  const generationHistory: GenerationResult[] = [];
  let bestEver: Individual = population[0];
  
  for (let gen = 0; gen < config.maxGenerations; gen++) {
    population.sort((a, b) => b.fitness - a.fitness);
    
    if (population[0].fitness > bestEver.fitness) {
      bestEver = { ...population[0], genes: { ...population[0].genes } };
    }
    
    const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;
    
    const genResult: GenerationResult = {
      generation: gen + 1,
      bestFitness: population[0].fitness,
      averageFitness: avgFitness,
      bestIndividual: { ...population[0].genes },
    };
    
    generationHistory.push(genResult);
    
    if (onProgress) {
      onProgress(genResult);
    }
    
    const newPopulation: Individual[] = [];
    
    for (let i = 0; i < config.eliteCount && i < population.length; i++) {
      newPopulation.push({ ...population[i], genes: { ...population[i].genes } });
    }
    
    while (newPopulation.length < config.populationSize) {
      const parent1 = tournamentSelection(population);
      const parent2 = tournamentSelection(population);
      
      let offspring: Individual;
      if (Math.random() < config.crossoverRate) {
        offspring = crossover(parent1, parent2, config);
      } else {
        offspring = { genes: { ...parent1.genes }, fitness: 0 };
      }
      
      offspring = mutate(offspring, config);
      offspring.fitness = calculateFitness(offspring.genes, observed, area);
      newPopulation.push(offspring);
    }
    
    population = newPopulation;
  }
  
  population.sort((a, b) => b.fitness - a.fitness);
  if (population[0].fitness > bestEver.fitness) {
    bestEver = population[0];
  }
  
  const simulatedFlow = simulateRDII(bestEver.genes, observed.rainfall, area);
  
  let sumSquaredError = 0;
  let sumAbsError = 0;
  let sumXY = 0;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let simPeak = 0;
  let obsPeak = 0;
  let simVolume = 0;
  let obsVolume = 0;
  const n = observed.flows.length;
  
  for (let i = 0; i < n; i++) {
    const obs = observed.flows[i] || 0;
    const sim = simulatedFlow[i] || 0;
    
    sumSquaredError += Math.pow(obs - sim, 2);
    sumAbsError += Math.abs(obs - sim);
    sumXY += obs * sim;
    sumX += obs;
    sumY += sim;
    sumX2 += obs * obs;
    sumY2 += sim * sim;
    
    if (obs > obsPeak) obsPeak = obs;
    if (sim > simPeak) simPeak = sim;
    
    obsVolume += obs;
    simVolume += sim;
  }
  
  const meanObs = sumX / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssTot += Math.pow((observed.flows[i] || 0) - meanObs, 2);
  }
  
  const nashSutcliffe = ssTot > 0 ? 1 - sumSquaredError / ssTot : 0;
  const rmse = Math.sqrt(sumSquaredError / n);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const correlationCoefficient = denominator > 0 ? numerator / denominator : 0;
  
  const peakFlowError = obsPeak > 0 ? (simPeak - obsPeak) / obsPeak * 100 : 0;
  const volumeError = obsVolume > 0 ? (simVolume - obsVolume) / obsVolume * 100 : 0;
  
  return {
    optimizedParameters: bestEver.genes,
    finalFitness: bestEver.fitness,
    generationHistory,
    simulatedFlow,
    observedFlow: observed.flows,
    timestamps: observed.timestamps,
    statistics: {
      nashSutcliffe,
      rmse,
      correlationCoefficient,
      peakFlowError,
      volumeError,
    },
  };
}

export function generateSyntheticObservedData(
  trueParams: RTKParameters,
  rainfallData: number[],
  area: number,
  noiseLevel: number = 0.1
): ObservedData {
  const trueFlow = simulateRDII(trueParams, rainfallData, area);
  
  const noisyFlow = trueFlow.map(f => {
    const noise = (Math.random() - 0.5) * 2 * noiseLevel * f;
    return Math.max(0, f + noise);
  });
  
  return {
    timestamps: rainfallData.map((_, i) => i),
    flows: noisyFlow,
    rainfall: rainfallData,
  };
}
