export interface HistoricalStorm {
  id: string;
  name: string;
  date: string;
  region: string;
  state: string;
  returnPeriod: string;
  totalDepthIn: number;
  durationHrs: number;
  peakIntensityInHr: number;
  description: string;
  hourlyRainfallIn: number[];
}

export const REGIONS = [
  "Southeast",
  "Northeast",
  "Midwest",
  "Southwest",
  "West Coast",
  "Gulf Coast",
  "Mid-Atlantic",
  "Great Plains",
] as const;

export const RETURN_PERIODS = [
  "2-year",
  "5-year",
  "10-year",
  "25-year",
  "50-year",
  "100-year",
] as const;

function generateHyetograph(totalDepth: number, durationHrs: number, peakPosition: number, peakFraction: number): number[] {
  const hourly: number[] = new Array(durationHrs).fill(0);
  const peakIdx = Math.floor(peakPosition * (durationHrs - 1));
  let sum = 0;

  for (let i = 0; i < durationHrs; i++) {
    const dist = Math.abs(i - peakIdx);
    const scale = Math.max(0, 1 - (dist / (durationHrs * 0.5)));
    hourly[i] = scale * scale;
    sum += hourly[i];
  }

  if (sum > 0) {
    for (let i = 0; i < durationHrs; i++) {
      hourly[i] = (hourly[i] / sum) * totalDepth;
    }
  }

  const actualPeak = Math.max(...hourly);
  const targetPeak = totalDepth * peakFraction;
  if (actualPeak > 0) {
    const boost = targetPeak / actualPeak;
    const remaining = totalDepth - targetPeak;
    const othersSum = sum - (hourly[peakIdx] || 0);
    for (let i = 0; i < durationHrs; i++) {
      if (i === peakIdx) {
        hourly[i] = targetPeak;
      } else if (othersSum > 0) {
        hourly[i] = (hourly[i] / othersSum) * remaining * (boost > 1 ? 0.9 : 1);
      }
    }
  }

  let finalSum = hourly.reduce((a, b) => a + b, 0);
  if (finalSum > 0) {
    for (let i = 0; i < durationHrs; i++) {
      hourly[i] = Math.round((hourly[i] / finalSum) * totalDepth * 1000) / 1000;
    }
  }

  return hourly;
}

export const HISTORICAL_STORMS: HistoricalStorm[] = [
  {
    id: "harvey-2017",
    name: "Hurricane Harvey",
    date: "2017-08-25",
    region: "Gulf Coast",
    state: "TX",
    returnPeriod: "100-year",
    totalDepthIn: 12.5,
    durationHrs: 48,
    peakIntensityInHr: 2.8,
    description: "Catastrophic flooding in Houston. Record rainfall for continental US hurricane.",
    hourlyRainfallIn: generateHyetograph(12.5, 48, 0.35, 0.22),
  },
  {
    id: "ida-2021",
    name: "Hurricane Ida (NE Impact)",
    date: "2021-09-01",
    region: "Northeast",
    state: "NJ",
    returnPeriod: "100-year",
    totalDepthIn: 8.4,
    durationHrs: 24,
    peakIntensityInHr: 3.2,
    description: "Record flooding in NYC/NJ. Over 3 in/hr peak in Central Park.",
    hourlyRainfallIn: generateHyetograph(8.4, 24, 0.4, 0.38),
  },
  {
    id: "florence-2018",
    name: "Hurricane Florence",
    date: "2018-09-14",
    region: "Southeast",
    state: "NC",
    returnPeriod: "100-year",
    totalDepthIn: 10.2,
    durationHrs: 48,
    peakIntensityInHr: 1.8,
    description: "Slow-moving storm caused extreme flooding in Carolinas.",
    hourlyRainfallIn: generateHyetograph(10.2, 48, 0.3, 0.18),
  },
  {
    id: "ellicott-city-2016",
    name: "Ellicott City Flash Flood",
    date: "2016-07-30",
    region: "Mid-Atlantic",
    state: "MD",
    returnPeriod: "100-year",
    totalDepthIn: 6.5,
    durationHrs: 6,
    peakIntensityInHr: 3.5,
    description: "Devastating flash flood from intense thunderstorm. Historic Main Street destroyed.",
    hourlyRainfallIn: generateHyetograph(6.5, 6, 0.5, 0.54),
  },
  {
    id: "baton-rouge-2016",
    name: "Baton Rouge Flood",
    date: "2016-08-12",
    region: "Gulf Coast",
    state: "LA",
    returnPeriod: "100-year",
    totalDepthIn: 11.0,
    durationHrs: 36,
    peakIntensityInHr: 2.1,
    description: "Unnamed storm caused record flooding. 30+ inches in some areas over 3 days.",
    hourlyRainfallIn: generateHyetograph(11.0, 36, 0.45, 0.19),
  },
  {
    id: "detroit-2014",
    name: "Detroit Metro Flood",
    date: "2014-08-11",
    region: "Midwest",
    state: "MI",
    returnPeriod: "50-year",
    totalDepthIn: 4.5,
    durationHrs: 8,
    peakIntensityInHr: 2.2,
    description: "Flash flooding overwhelmed Detroit sewer system. Major freeway closures.",
    hourlyRainfallIn: generateHyetograph(4.5, 8, 0.4, 0.49),
  },
  {
    id: "nashville-2010",
    name: "Nashville Flood",
    date: "2010-05-01",
    region: "Southeast",
    state: "TN",
    returnPeriod: "100-year",
    totalDepthIn: 7.2,
    durationHrs: 24,
    peakIntensityInHr: 1.8,
    description: "Cumberland River flooding. Over $2B in damages.",
    hourlyRainfallIn: generateHyetograph(7.2, 24, 0.35, 0.25),
  },
  {
    id: "chicago-2013",
    name: "Chicago April Storm",
    date: "2013-04-18",
    region: "Midwest",
    state: "IL",
    returnPeriod: "25-year",
    totalDepthIn: 5.3,
    durationHrs: 18,
    peakIntensityInHr: 1.5,
    description: "Widespread flooding and CSO events across metropolitan Chicago.",
    hourlyRainfallIn: generateHyetograph(5.3, 18, 0.45, 0.28),
  },
  {
    id: "sc-flood-2015",
    name: "South Carolina Flood",
    date: "2015-10-03",
    region: "Southeast",
    state: "SC",
    returnPeriod: "100-year",
    totalDepthIn: 11.5,
    durationHrs: 36,
    peakIntensityInHr: 2.4,
    description: "Thousand-year rainfall event. Dam breaches and catastrophic flooding.",
    hourlyRainfallIn: generateHyetograph(11.5, 36, 0.4, 0.21),
  },
  {
    id: "atlanta-2009",
    name: "Atlanta September Flood",
    date: "2009-09-21",
    region: "Southeast",
    state: "GA",
    returnPeriod: "50-year",
    totalDepthIn: 5.8,
    durationHrs: 12,
    peakIntensityInHr: 2.0,
    description: "Heavy rainfall caused flash flooding. Significant SSO events.",
    hourlyRainfallIn: generateHyetograph(5.8, 12, 0.5, 0.34),
  },
  {
    id: "phoenix-2014",
    name: "Phoenix Monsoon Storm",
    date: "2014-09-08",
    region: "Southwest",
    state: "AZ",
    returnPeriod: "25-year",
    totalDepthIn: 3.3,
    durationHrs: 6,
    peakIntensityInHr: 2.5,
    description: "Record monsoon rainfall for Phoenix. Widespread urban flooding.",
    hourlyRainfallIn: generateHyetograph(3.3, 6, 0.4, 0.76),
  },
  {
    id: "nyc-2012-sandy",
    name: "Superstorm Sandy",
    date: "2012-10-29",
    region: "Northeast",
    state: "NY",
    returnPeriod: "100-year",
    totalDepthIn: 4.7,
    durationHrs: 24,
    peakIntensityInHr: 0.9,
    description: "Storm surge combined with rainfall caused massive sewer system impacts.",
    hourlyRainfallIn: generateHyetograph(4.7, 24, 0.5, 0.19),
  },
  {
    id: "pittsburgh-2004",
    name: "Hurricane Ivan Remnants (Pittsburgh)",
    date: "2004-09-17",
    region: "Mid-Atlantic",
    state: "PA",
    returnPeriod: "50-year",
    totalDepthIn: 5.5,
    durationHrs: 18,
    peakIntensityInHr: 1.6,
    description: "Remnants of Ivan caused major flooding. Record RDII in ALCOSAN system.",
    hourlyRainfallIn: generateHyetograph(5.5, 18, 0.4, 0.29),
  },
  {
    id: "milwaukee-2010",
    name: "Milwaukee July Storm",
    date: "2010-07-22",
    region: "Midwest",
    state: "WI",
    returnPeriod: "25-year",
    totalDepthIn: 4.8,
    durationHrs: 12,
    peakIntensityInHr: 1.7,
    description: "Intense thunderstorm caused significant SSOs across metro area.",
    hourlyRainfallIn: generateHyetograph(4.8, 12, 0.35, 0.35),
  },
  {
    id: "denver-2013",
    name: "Colorado Front Range Flood",
    date: "2013-09-12",
    region: "Great Plains",
    state: "CO",
    returnPeriod: "100-year",
    totalDepthIn: 9.0,
    durationHrs: 48,
    peakIntensityInHr: 1.2,
    description: "Multi-day rainfall event along Front Range. Extreme flooding from Boulder to Denver.",
    hourlyRainfallIn: generateHyetograph(9.0, 48, 0.35, 0.13),
  },
  {
    id: "portland-2015",
    name: "Portland December Storm",
    date: "2015-12-07",
    region: "West Coast",
    state: "OR",
    returnPeriod: "10-year",
    totalDepthIn: 3.2,
    durationHrs: 24,
    peakIntensityInHr: 0.6,
    description: "Atmospheric river event. Sustained rainfall caused I&I issues.",
    hourlyRainfallIn: generateHyetograph(3.2, 24, 0.4, 0.19),
  },
  {
    id: "seattle-2016",
    name: "Seattle October Deluge",
    date: "2016-10-15",
    region: "West Coast",
    state: "WA",
    returnPeriod: "10-year",
    totalDepthIn: 2.8,
    durationHrs: 18,
    peakIntensityInHr: 0.5,
    description: "Atmospheric river with prolonged moderate rainfall. High GWI response.",
    hourlyRainfallIn: generateHyetograph(2.8, 18, 0.5, 0.18),
  },
  {
    id: "kansas-city-2017",
    name: "Kansas City August Storm",
    date: "2017-08-22",
    region: "Great Plains",
    state: "MO",
    returnPeriod: "25-year",
    totalDepthIn: 4.2,
    durationHrs: 8,
    peakIntensityInHr: 2.0,
    description: "Intense summer thunderstorm. Major SSO events in combined sewer areas.",
    hourlyRainfallIn: generateHyetograph(4.2, 8, 0.45, 0.48),
  },
  {
    id: "memphis-2011",
    name: "Memphis Spring Flood",
    date: "2011-05-02",
    region: "Southeast",
    state: "TN",
    returnPeriod: "50-year",
    totalDepthIn: 6.1,
    durationHrs: 24,
    peakIntensityInHr: 1.4,
    description: "Mississippi River flooding combined with local rainfall. Severe I&I.",
    hourlyRainfallIn: generateHyetograph(6.1, 24, 0.4, 0.23),
  },
  {
    id: "des-moines-2018",
    name: "Des Moines June Storm",
    date: "2018-06-30",
    region: "Midwest",
    state: "IA",
    returnPeriod: "25-year",
    totalDepthIn: 4.0,
    durationHrs: 10,
    peakIntensityInHr: 1.8,
    description: "Summer convective storm. Rapid RDII response in separated system.",
    hourlyRainfallIn: generateHyetograph(4.0, 10, 0.35, 0.45),
  },
  {
    id: "norfolk-2016",
    name: "Norfolk Tidal + Rain Event",
    date: "2016-09-20",
    region: "Mid-Atlantic",
    state: "VA",
    returnPeriod: "10-year",
    totalDepthIn: 3.5,
    durationHrs: 12,
    peakIntensityInHr: 1.0,
    description: "Combined tidal influence and rainfall. Chronic I&I area.",
    hourlyRainfallIn: generateHyetograph(3.5, 12, 0.5, 0.29),
  },
  {
    id: "tucson-2021",
    name: "Tucson Monsoon Burst",
    date: "2021-07-23",
    region: "Southwest",
    state: "AZ",
    returnPeriod: "10-year",
    totalDepthIn: 2.5,
    durationHrs: 4,
    peakIntensityInHr: 2.0,
    description: "Short-duration high-intensity monsoon. Rapid runoff response.",
    hourlyRainfallIn: generateHyetograph(2.5, 4, 0.5, 0.80),
  },
  {
    id: "sj-atm-river-2023",
    name: "San Jose Atmospheric River",
    date: "2023-01-09",
    region: "West Coast",
    state: "CA",
    returnPeriod: "25-year",
    totalDepthIn: 5.0,
    durationHrs: 36,
    peakIntensityInHr: 0.8,
    description: "Pineapple Express event. Prolonged rainfall with high antecedent moisture.",
    hourlyRainfallIn: generateHyetograph(5.0, 36, 0.45, 0.16),
  },
  {
    id: "indianapolis-2019",
    name: "Indianapolis May Storm",
    date: "2019-05-28",
    region: "Midwest",
    state: "IN",
    returnPeriod: "10-year",
    totalDepthIn: 3.1,
    durationHrs: 8,
    peakIntensityInHr: 1.3,
    description: "Spring thunderstorm with typical Midwest RDII response pattern.",
    hourlyRainfallIn: generateHyetograph(3.1, 8, 0.4, 0.42),
  },
  {
    id: "omaha-2019",
    name: "Omaha Bomb Cyclone Aftermath",
    date: "2019-03-15",
    region: "Great Plains",
    state: "NE",
    returnPeriod: "50-year",
    totalDepthIn: 2.2,
    durationHrs: 12,
    peakIntensityInHr: 0.5,
    description: "Rain-on-snow event with frozen ground. Extreme GWI and I&I response.",
    hourlyRainfallIn: generateHyetograph(2.2, 12, 0.5, 0.23),
  },
];

export function filterStorms(opts: {
  region?: string;
  returnPeriod?: string;
  minDepth?: number;
  maxDuration?: number;
}): HistoricalStorm[] {
  return HISTORICAL_STORMS.filter(s => {
    if (opts.region && opts.region !== "All" && s.region !== opts.region) return false;
    if (opts.returnPeriod && opts.returnPeriod !== "All" && s.returnPeriod !== opts.returnPeriod) return false;
    if (opts.minDepth && s.totalDepthIn < opts.minDepth) return false;
    if (opts.maxDuration && s.durationHrs > opts.maxDuration) return false;
    return true;
  });
}

export function stormToTimeSeriesData(storm: HistoricalStorm): {
  timestamps: Date[];
  values: number[];
} {
  const base = new Date(storm.date + "T00:00:00");
  const timestamps: Date[] = [];
  const values: number[] = [];

  for (let i = 0; i < storm.hourlyRainfallIn.length; i++) {
    const ts = new Date(base.getTime() + i * 3600000);
    timestamps.push(ts);
    values.push(storm.hourlyRainfallIn[i]);
  }
  return { timestamps, values };
}
