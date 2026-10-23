# AquaSense — Smart Rainwater Harvesting and Groundwater Recharge System

AquaSense is a college mini-project that combines hydrology engineering principles, official meteorological observational data, and Scikit-Learn machine learning to assist urban households and campus planners in optimizing rainwater harvesting and artificial groundwater recharge.

Built with a **React + Vite** frontend, a **FastAPI + SQLite** backend, and real historical climate observations from the **India Meteorological Department (IMD)**.

---

## 1. Project Overview

Rapid urbanisation in Indian metropolitan cities like Hyderabad has led to severe depletion of groundwater tables alongside seasonal urban flash floods. AquaSense provides a decision-support platform that:
- Ingests **genuine historical daily rainfall data** from official IMD gridded datasets for Hyderabad (Telangana).
- Trains reproducible **Machine Learning models** (`RandomForestRegressor` and `GaussianNB`) to forecast next-month rainfall depth and seasonal categories (Dry, Normal, Heavy).
- Implements deterministic hydrological calculations to calculate **harvestable rainwater volume** ($V = A \times R \times C$) in Litres and Kilolitres.
- Evaluates real-time **tank storage capacity, headroom, and overflow**, automatically recommending whether to **Store** rainwater, **Use** it to create buffer capacity, divert surplus runoff to **Recharge** groundwater aquifers, or **Conserve** emergency reserves during drought.
- Automatically stores all operations and predictions in an embedded **SQLite database** with instant CSV export capabilities.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18 with Vite
- **Language:** JavaScript (ES Modules) & JSX
- **Routing:** React Router v6
- **Charts:** Recharts (Responsive bar chart of monthly historical rainfall)
- **HTTP Client:** Axios (Centralized API client with configurable base URL)
- **Icons:** Lucide React
- **Styling:** Custom plain CSS design system with an aqua, ocean teal, and navy color palette

### Backend
- **Framework:** FastAPI
- **Server:** Uvicorn (ASGI)
- **Data Validation & Schemas:** Pydantic v2
- **Database:** SQLite3 (`aquasense.db`) with automatic table creation
- **Data Analysis & Hydrology:** pandas, NumPy, SciPy (NetCDF parser)
- **Machine Learning:** scikit-learn (`RandomForestRegressor`, `GaussianNB`), joblib
- **Testing:** pytest, FastAPI TestClient (`httpx`)

---

## 3. Project Structure

```text
aquasense/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Navigation header with live API status badge
│   │   │   └── Alert.jsx          # Accessible status feedback banner
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx          # Page 1: KPIs, Recharts bar chart, history tabs
│   │   │   ├── RainfallPrediction.jsx # Page 2: ML forecast form, held-out metrics, classifier
│   │   │   ├── WaterCalculator.jsx    # Page 3: Hydrologic volume calculator & presets
│   │   │   └── TankManagement.jsx     # Page 4: Tank fill gauge, balance grid & recommendations
│   │   ├── services/
│   │   │   └── api.js             # Centralized Axios API client
│   │   ├── App.jsx                # Router configuration & sticky footer
│   │   ├── main.jsx               # React entry point
│   │   └── index.css              # AquaSense design system stylesheet
│   ├── package.json
│   ├── .env.example
│   └── .env
├── backend/
│   ├── main.py                    # FastAPI application, CORS, lifespan, and endpoints
│   ├── database.py                # SQLite initialisation and CRUD helpers
│   ├── schemas.py                 # Pydantic request and response schemas
│   ├── water_service.py           # Hydrology calculations and rule-based tank engine
│   ├── ml_model.py                # Model loader, predictor, and metrics service
│   ├── train_models.py            # Chronological train/test split ML training script
│   ├── preprocess_data.py         # Official IMD NetCDF downloader and grid extractor
│   ├── requirements.txt           # Python dependency specifications
│   ├── data/
│   │   ├── raw/                   # Raw official IMD NetCDF binary files (cached)
│   │   └── rainfall.csv           # Validated daily rainfall dataset (date, rainfall_mm)
│   ├── saved_models/
│   │   ├── rainfall_rf_regressor.joblib
│   │   ├── rainfall_nb_classifier.joblib
│   │   └── model_metadata.json    # Measured test metrics, features, and thresholds
│   └── tests/
│       ├── test_water_service.py  # Unit tests for hydrology formulas & rules
│       ├── test_database.py       # Unit tests for SQLite CRUD & schema
│       └── test_api.py            # Integration tests for all FastAPI endpoints
├── .gitignore
└── README.md
```

---

## 4. Official IMD Rainfall Dataset

AquaSense uses **official historical daily rainfall observations** from the India Meteorological Department. **No fabricated, synthetic, or dummy rainfall values are used.**

### Dataset Specifications
- **Primary Source:** [IMD Pune 0.25° Gridded Rainfall Portal](https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html)
- **Selected Grid Cell:** **Latitude 17.5° N, Longitude 78.5° E** (closest valid 0.25° grid node to Hyderabad city center: 17.4° N, 78.5° E).
- **Date Range:** **2015-01-01 to 2024-12-31** (10 full years).
- **Total Valid Daily Observations:** **3,653 daily records**.
- **Days with Rain (> 0 mm):** 1,054 days.
- **Daily Maximum Rainfall:** 190.11 mm.
- **Units:** Millimetres ($mm$).
- **Missing Value Handling:** IMD missing observation flag (`-999.0`) is preserved as missing (`NaN`) and excluded from monthly sums without converting to zero.

### Automated Download & Preprocessing
To download and extract the official data automatically:
```powershell
cd backend
python preprocess_data.py --start-year 2015 --end-year 2024
```
This queries the IMD Pune portal, saves raw `.nc` files in `backend/data/raw/`, extracts the Hyderabad grid coordinate, validates records, and writes `backend/data/rainfall.csv`.

*Manual Download Alternative:* If the IMD Pune server is unreachable due to institutional firewalls, visit [IMD NetCDF Portal](https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html), select the year from the dropdown, download `ind<year>_rfp25.nc`, place it into `backend/data/raw/`, and re-run `python preprocess_data.py`.

---

## 5. Machine Learning Pipeline

AquaSense uses two genuine Scikit-Learn models trained on monthly aggregations of the real IMD Hyderabad observations.

### Feature Engineering (Zero Future-Data Leakage)
To predict monthly rainfall at month $t$, the models strictly use past information:
- `month`: Calendar month (1–12) to capture seasonal monsoon timing.
- `sin_month`, `cos_month`: Cyclical sine and cosine trigonometric encodings.
- `lag_1`: Rainfall of previous month ($t-1$).
- `lag_2`: Rainfall of two months prior ($t-2$).
- `lag_3`: Rainfall of three months prior ($t-3$).
- `lag_12`: Rainfall of the exact same month in the prior year ($t-12$).
- `rolling_3`: 3-month rolling mean of prior rainfall.

### Model A: Rainfall Regression (`RandomForestRegressor`)
- **Estimator:** Random Forest Regressor (`n_estimators=100`, `max_depth=5`, `random_state=42`).
- **Data Split:** **80% train / 20% test strictly chronological split** (Train: 86 months from 2016-01 to 2023-02; Test: 22 months from 2023-03 to 2024-12).
- **Actual Measured Evaluation Metrics on Held-out Test Data:**
  - **Mean Absolute Error (MAE):** **45.82 mm**
  - **Root Mean Squared Error (RMSE):** **60.42 mm**
  - **$R^2$ Score:** **0.542**

### Model B: Rainfall Classification (`GaussianNB`)
- **Estimator:** Gaussian Naive Bayes classifier.
- **Category Thresholds (33.3rd and 66.6th percentiles of historical training distribution):**
  - **Dry:** $< 6.6\text{ mm}$ (non-monsoon / winter months)
  - **Normal:** $6.6\text{ mm}$ to $93.4\text{ mm}$ (pre-monsoon / transitional months)
  - **Heavy:** $\ge 93.4\text{ mm}$ (active monsoon months: July, August, September)
- **Actual Measured Test Accuracy on Held-out Data:** **54.55%**

### Model Limitations
These models provide empirical statistical forecasts based on seasonal cyclicality and historical lags. They do not simulate live atmospheric satellite feeds, wind velocities, or barometric air pressure. They should be used for domestic rainwater harvesting capacity planning rather than live severe weather warnings.

---

## 6. Hydrology & Recommendation Formulas

### Water Harvesting Formula
$$V = A \times R \times C$$
Where:
- $V$ = Harvestable water volume in **Litres** ($L$).
- $A$ = Roof catchment area in **square metres** ($m^2$).
- $R$ = Rainfall depth in **millimetres** ($mm$).
- $C$ = Catchment runoff coefficient (default 0.80).
- *Physical rationale:* $1\text{ mm}$ of rain depth spread over $1\text{ m}^2$ equals exactly $1\text{ Litre}$ ($0.001\text{ m}^3$).

### Tank Recommendation Rules
- **Recharge Aquifer:** Triggered when expected harvest exceeds available tank headroom ($V_{\text{overflow}} > 0.1 \times \text{Capacity}$ or Fill $\ge 85\%$). Recommends diverting surplus clean rainwater into a percolation pit or recharge well.
- **Store Harvest:** Triggered when tank has ample available capacity. Keeps intake valves open to maximize stored domestic supply.
- **Use Water:** Triggered when tank is $\ge 70\%$ full and heavy rainfall is imminent. Recommends utilizing stored water for secondary non-potable needs (cleaning, gardening) to create buffer headroom and prevent avoidable overflow.
- **Conserve Reserves:** Triggered when storage is low ($< 30\%$) and upcoming rain is minimal ($< 10\text{ mm}$). Recommends conserving stored water for critical household needs.

---

## 7. Windows Setup Instructions

Run these commands in Windows PowerShell:

### Prerequisites
- Python 3.10+ installed and added to `PATH`.
- Node.js 18+ and npm installed.

### Backend Setup
```powershell
# 1. Open PowerShell and navigate to the backend directory
cd C:\Users\mrudu\.gemini\antigravity\scratch\aquasense\backend

# 2. Create and activate a Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 3. Install required Python packages
pip install -r requirements.txt

# 4. Preprocess official IMD rainfall data (downloads and validates 2015-2024 NetCDFs)
python preprocess_data.py --start-year 2015 --end-year 2024

# 5. Train the Scikit-Learn regression and classification models
python train_models.py

# 6. Start the FastAPI development server
uvicorn main:app --reload --port 8000
```

### Frontend Setup
In a new PowerShell terminal:
```powershell
# 1. Navigate to the frontend directory
cd C:\Users\mrudu\.gemini\antigravity\scratch\aquasense\frontend

# 2. Install npm dependencies
npm install

# 3. Start the Vite development server
npm run dev
```

### Local Application Addresses
- **Frontend Web UI:** `http://127.0.0.1:5173`
- **Backend API:** `http://127.0.0.1:8000`
- **Interactive Swagger API Documentation:** `http://127.0.0.1:8000/docs`

---

## 8. Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend status, DB connectivity, and ML model loaded flag |
| `GET` | `/api/dashboard` | Historical observation KPIs, monthly rainfall series, and recent records |
| `POST` | `/api/predict/rainfall` | Random Forest rainfall prediction + GaussianNB classification (persisted to SQLite) |
| `POST` | `/api/predict/classify` | Quick rainfall classification into Dry / Normal / Heavy using model thresholds |
| `GET` | `/api/models/metrics` | Actual held-out test evaluation metrics (MAE, RMSE, $R^2$, Accuracy) |
| `POST` | `/api/water/calculate` | Hydrological rainwater volume calculation (persisted to SQLite) |
| `POST` | `/api/tank/recommend` | Storage balance evaluation & rule-based recommendations (persisted to SQLite) |
| `GET` | `/api/history` | List recent saved predictions, calculations, and recommendations |
| `GET` | `/api/history/export` | Download complete database operational log as a CSV file |

---

## 9. Running Tests

To execute the automated test suite with pytest:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest -v
```

**Test Coverage Summary (18 passing tests):**
- `test_health_endpoint`: Verifies API uptime, database connectivity, and model availability.
- `test_dashboard_endpoint`: Validates genuine observation counts and chart data format.
- `test_predict_rainfall_success`: Verifies ML regression and classification output structure.
- `test_predict_rainfall_validation_error`: Ensures unsupported years/months return HTTP 422.
- `test_classify_rainfall_endpoint`: Verifies Dry, Normal, and Heavy classification logic.
- `test_model_metrics_endpoint`: Confirms held-out metrics are reported correctly.
- `test_water_calculate_endpoint`: Validates $V = A \times R \times C$ and database row insertion.
- `test_water_calculate_validation_failure`: Verifies invalid and negative inputs are rejected.
- `test_tank_recommend_endpoint`: Verifies tank overflow calculation and recommendation.
- `test_history_and_export_endpoints`: Validates history query and downloadable CSV output.
- `test_database_initialisation`: Verifies SQLite tables exist on startup.
- `test_save_and_retrieve_history`: Verifies insert and select operations across all 3 tables.
- `test_water_harvesting_calculation`: Unit test for formula precision.
- `test_water_harvesting_validation`: Unit test for boundary exceptions.
- `test_tank_recommendation_store`: Unit test for "Store" recommendation.
- `test_tank_recommendation_recharge_on_overflow`: Unit test for "Recharge" overflow detection.
- `test_tank_recommendation_conserve`: Unit test for "Conserve" water deficit logic.
- `test_tank_recommendation_validation`: Unit test for tank input sanity checks.

---

## 10. Troubleshooting & Common Questions

1. **PowerShell script execution policy error (`Activate.ps1 cannot be loaded`)**
   - Solution: Run PowerShell as Administrator and execute:
     `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
2. **Port 8000 or 5173 is already in use**
   - Solution: For backend, specify another port: `uvicorn main:app --reload --port 8001`. Then update `frontend/.env` with `VITE_API_BASE_URL=http://127.0.0.1:8001`.
3. **IMD Pune connection timeout or SSL error**
   - Solution: `preprocess_data.py` includes an unverified SSL context specifically designed for Indian meteorological portals. If your network completely restricts outbound Python requests, manually place the downloaded `.nc` files in `backend/data/raw/` and run `python preprocess_data.py`.
4. **Where is SQLite data stored?**
   - The database file is located at `backend/aquasense.db`. It is created automatically upon first startup.
