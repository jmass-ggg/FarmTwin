# 🌱 FarmTwin

**Understand your farm before you plant.**

FarmTwin is a climate-smart agricultural decision-support platform that combines **real weather, satellite, soil, terrain, and climate data** to create a digital profile of a farm.

It helps answer practical questions such as:

* What crop is suitable for my farm?
* Is rainfall enough for that crop?
* What climate risks should I prepare for?
* What should I plant throughout the year?

---

## 🌍 The Problem

Farmers make important decisions about crops, planting time, water, and climate risks, but the environmental data needed for those decisions is scattered across different platforms.

FarmTwin brings those data sources together and converts them into **farm-specific, explainable recommendations**.

---

## 📊 Why This Matters

Climate shocks already create major agricultural losses in Kenya. During the **2024 floods**, the agriculture sector recorded about **KES 34.9 billion in physical damage** and **KES 84.8 billion in production losses**.

Farmers still have to make planting, water, and climate-risk decisions using information spread across weather services, satellite systems, soil databases, and climate datasets.

**FarmTwin was built to bring these signals together at the individual farm level and turn them into practical, explainable decisions.**


## 💡 How FarmTwin Works

1. Draw or select a farm on the map.
2. FarmTwin collects environmental data for that location.
3. The data is combined into a **Farm Digital Twin**.
4. FarmTwin's engines analyze crop suitability, water needs, and climate risks.
5. The system produces crop recommendations and a 12-month planting plan.

![FarmTwin System Flow](photos/workflow.png)

```text
Select Farm
     ↓
Collect Environmental Data
     ↓
Farm Digital Twin
     ↓
Crop + Risk + Planning Engines
     ↓
Recommendations
```

---

## 🛰️ Real Environmental Data

FarmTwin integrates multiple environmental providers:

| Data      | Source         | Used For                                        |
| --------- | -------------- | ----------------------------------------------- |
| Weather   | Open-Meteo     | Temperature, rainfall, wind and forecast        |
| Satellite | Sentinel-2     | NDVI vegetation health and NDMI moisture        |
| Soil      | SoilGrids      | pH, texture, organic carbon and soil properties |
| Terrain   | Copernicus DEM | Elevation and slope                             |
| Climate   | ERA5-Land      | Historical climate patterns and anomalies       |
| Station   | Conduit IoT    | Local sensor data when available                |

Each observation keeps its **source, timestamp, resolution, and quality status**.

Missing environmental data is not fabricated.

---

## 🧬 Farm Digital Twin

FarmTwin combines the available environmental information into one farm-specific profile.

```text
Weather + Satellite + Soil + Terrain + Climate + Sensors
                           ↓
                  Farm Digital Twin
```

This digital twin becomes the input for FarmTwin's decision engines.

---

## 🌾 Crop Suitability Engine

The Crop Engine compares actual farm conditions against the requirements of **20+ crops**.

It evaluates factors such as:

* Temperature
* Rainfall
* Soil pH and texture
* Elevation and slope
* Seasonal climate conditions

Example:

```text
Maize Suitability: 82/100

Temperature     ✓ Suitable
Soil            ✓ Suitable
Terrain         ✓ Suitable
Rainfall        ⚠ Below optimal

Main limitation: Water availability
```

The calculations are **rule-based and transparent**, so users can understand why a crop received its score.

---

## ⚠️ Climate Risk & Water Analysis

FarmTwin analyzes risks including:

* Drought
* Heat stress
* Heavy rainfall / flooding
* Wind exposure
* Seasonal rainfall anomalies

It also compares expected rainfall with crop water requirements.

```text
Crop water requirement: 420 mm
Expected rainfall:       310 mm
Estimated deficit:       110 mm
```

This helps farmers understand possible irrigation and climate risks before planting.

---

## 📅 Annual Crop Planner

FarmTwin uses:

**Crop suitability + planting seasons + rainfall + growing duration + crop rotation**

to generate a practical **12-month crop plan**.

```text
Mar – Jun   → Maize
Jul – Sep   → Kale
Oct – Dec   → Beans
```

---

## 🤖 AI Explanations

AI is used only to explain calculated results in simple language.

It **does not calculate crop scores or climate risks**.

```text
Environmental Data
        ↓
Rule-Based Calculation
        ↓
Result
        ↓
AI Explanation
```

This keeps FarmTwin's recommendations explainable and auditable.

---

## 🏗️ Tech Stack

**Frontend**

* Next.js / React 19
* TypeScript
* Tailwind CSS
* MapLibre GL JS

**Backend**

* FastAPI
* Python 3.12
* PostgreSQL + PostGIS
* Redis
* Pydantic

**Infrastructure & Testing**

* Docker / Docker Compose
* Pytest
* Hypothesis

---

## ✨ Main Features

* Interactive farm boundary selection
* Farm Digital Twin
* 6 environmental data integrations
* Sentinel-2 NDVI / NDMI analysis
* 20+ crop suitability simulations
* Water requirement analysis
* Climate and disaster risk assessment
* 12-month crop planning
* Data provenance and quality tracking
* AI-generated explanations

---

## 🐳 Run with Docker

```bash
git clone <repository-url>
cd farmtwin

cp backend/.env.example backend/.env

docker compose build
docker compose up -d
```

Open:

```text
Frontend:  http://localhost:3000
API:       http://localhost:8000
API Docs:  http://localhost:8000/docs
```

Stop:

```bash
docker compose down
```

---

## ⚠️ Accuracy & Limitations

FarmTwin is a **decision-support tool**, not a replacement for laboratory soil tests or professional agronomic advice.

Environmental datasets have different spatial resolutions and uncertainties. SoilGrids contains modeled soil estimates, weather forecasts can change, and satellite observations may be affected by cloud cover.

FarmTwin reports available data and its quality rather than presenting uncertain or missing measurements as fact.

---

## 🎯 Goal

FarmTwin turns complex environmental data into answers farmers can actually use:

> **What should I grow, when should I grow it, how much water might it need, and what climate risks should I prepare for?**

---

**FarmTwin — Understand your farm before you plant.**

*Better decisions. Healthier farms. Greener Kenya.*
