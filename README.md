# SSOAP Engine

A browser-based workbench for wet-weather sewer analysis: RDII (rainfall-derived infiltration and inflow) workflows, historical storm event data, and a guided path from raw storm data to analysis output.

Live app: https://replit.com/@robertdickinson/SSOAP-Engine

## What's inside

The app walks through a tabbed RDII analysis workflow, with bundled sample storm and sewer datasets so you can explore it without loading your own data first. A visualizer and progress tracker help organize the analytical steps, and there's a section for importing Ruby scripts from InfoWorks ICM, bridging this browser tool with existing ICM-based sewer modeling automation.

## Why this exists

RDII analysis work is often spread across spreadsheets, desktop utilities, and informal procedures. This app packages historical storm data and the RDII workflow into one guided interface, useful for prototyping wet-weather screening approaches, training and demonstration, or just having a faster way to explore a storm event than digging through raw files.

## Tech stack

Full-stack TypeScript, with a Vite-built frontend, Tailwind CSS, an Express backend, and Drizzle for the data layer. Originally built and hosted on Replit.

## Getting started

git clone https://github.com/dickinsonre/SSOAP-Engine.git
cd SSOAP-Engine
npm install
npm run dev

## Author

Robert Dickinson. 50+ years in hydraulic modeling, deep expertise in RDII analysis and RTK methodology since 1996. More at swmm5.org.
