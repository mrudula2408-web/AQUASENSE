"""
AquaSense - IMD Historical Rainfall Preprocessing Pipeline
Extracts daily rainfall observations from official IMD 0.25° NetCDF files
for Hyderabad, Telangana, India (Lat: 17.5° N, Lon: 78.5° E).
"""

import os
import sys
import argparse
import datetime
import urllib.request
import urllib.parse
import ssl
from pathlib import Path
import numpy as np
import pandas as pd
import scipy.io

IMD_URL = "https://www.imdpune.gov.in/cmpg/Griddata/RF25.php"
REFERER_URL = "https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html"

# Nearest grid coordinates to Hyderabad (17.4° N, 78.5° E)
TARGET_LAT = 17.5
TARGET_LON = 78.5

def download_imd_nc_year(year: int, dest_path: Path) -> bool:
    """Download official IMD 0.25 NetCDF for given year."""
    if dest_path.exists() and dest_path.stat().st_size > 1000000:
        print(f"[{year}] Using cached NetCDF: {dest_path.name} ({dest_path.stat().st_size / (1024*1024):.1f} MB)")
        return True

    print(f"[{year}] Downloading official IMD 0.25° NetCDF from {IMD_URL} ...")
    ctx = ssl._create_unverified_context()
    data = urllib.parse.urlencode({'RF25': str(year)}).encode('utf-8')
    req = urllib.request.Request(
        IMD_URL,
        data=data,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AquaSense/1.0',
            'Referer': REFERER_URL
        }
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as response:
            content = response.read()
            if len(content) < 500000:
                print(f"[{year}] Download response unexpectedly small ({len(content)} bytes). May not be available.")
                return False
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_path, 'wb') as f:
                f.write(content)
            print(f"[{year}] Successfully saved {dest_path.name} ({len(content) / (1024*1024):.1f} MB)")
            return True
    except Exception as e:
        print(f"[{year}] Failed to download: {e}")
        return False

def extract_grid_data(nc_path: Path, target_lat: float = TARGET_LAT, target_lon: float = TARGET_LON):
    """Extract daily rainfall series for specific lat/lon from IMD NetCDF."""
    records = []
    with scipy.io.netcdf_file(nc_path, mode='r', mmap=False) as nc:
        lats = nc.variables['LATITUDE'][:].copy()
        lons = nc.variables['LONGITUDE'][:].copy()
        time_var = nc.variables['TIME'][:].copy()

        # Find closest indices
        lat_idx = int(np.argmin(np.abs(lats - target_lat)))
        lon_idx = int(np.argmin(np.abs(lons - target_lon)))
        actual_lat = float(lats[lat_idx])
        actual_lon = float(lons[lon_idx])

        # Identify rainfall variable
        rf_var_name = None
        for name in ['RAINFALL', 'rainfall', 'rf', 'RF']:
            if name in nc.variables:
                rf_var_name = name
                break
        if not rf_var_name:
            candidates = [k for k in nc.variables if k not in ['LATITUDE', 'LONGITUDE', 'TIME']]
            if candidates:
                rf_var_name = candidates[0]
            else:
                raise ValueError(f"No rainfall variable found in {nc_path}")

        rf_data = nc.variables[rf_var_name][:].copy()

        # Extract time series for target grid cell
        grid_series = rf_data[:, lat_idx, lon_idx]
        
        # Origin date for IMD NetCDF is 1900-12-31
        origin = datetime.date(1900, 12, 31)

        for t_val, rain_val in zip(time_var, grid_series):
            day_offset = int(round(float(t_val)))
            obs_date = origin + datetime.timedelta(days=day_offset)
            val = float(rain_val)
            # IMD missing value is -999.0
            if val < 0.0 or np.isnan(val) or val == -999.0:
                clean_val = np.nan
            else:
                clean_val = round(val, 2)
            
            records.append({
                'date': obs_date.isoformat(),
                'rainfall_mm': clean_val
            })

    return records, actual_lat, actual_lon

def run_pipeline(start_year: int = 2014, end_year: int = 2024, raw_dir: str = "data/raw", output_file: str = "data/rainfall.csv"):
    raw_path = Path(raw_dir)
    out_path = Path(output_file)
    raw_path.mkdir(parents=True, exist_ok=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print("=================================================================")
    print("AquaSense: Official IMD Historical Rainfall Preprocessing Pipeline")
    print(f"Target Location: Hyderabad, Telangana (Grid Lat {TARGET_LAT}° N, Lon {TARGET_LON}° E)")
    print(f"Years to process: {start_year} to {end_year}")
    print("=================================================================")

    # 1. Download or locate files
    all_records = []
    actual_lat, actual_lon = TARGET_LAT, TARGET_LON
    successful_years = []

    for year in range(start_year, end_year + 1):
        nc_file = raw_path / f"ind{year}_rfp25.nc"
        success = download_imd_nc_year(year, nc_file)
        if success and nc_file.exists():
            try:
                records, lat_found, lon_found = extract_grid_data(nc_file, TARGET_LAT, TARGET_LON)
                actual_lat, actual_lon = lat_found, lon_found
                all_records.extend(records)
                successful_years.append(year)
                print(f"[{year}] Extracted {len(records)} daily observations.")
            except Exception as e:
                print(f"[{year}] Error extracting data from {nc_file.name}: {e}")

    # Fallback check if downloading is offline or blocked
    if not all_records:
        print("\n[WARNING] Could not extract data from online IMD NetCDF files.")
        if out_path.exists():
            print(f"Existing {output_file} detected. Verifying dataset...")
            df_exist = pd.read_csv(out_path)
            print(f"Found {len(df_exist)} existing records ({df_exist['date'].min()} to {df_exist['date'].max()}).")
            return
        else:
            print("\n[MANUAL DOWNLOAD INSTRUCTIONS]")
            print("1. Open the official IMD Pune portal in your browser:")
            print("   https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html")
            print("2. In the dropdown, select the year (e.g. 2020) and click 'Download'.")
            print(f"3. Save the downloaded 'ind<year>_rfp25.nc' into: {raw_path.resolve()}")
            print("4. Re-run: python preprocess_data.py\n")
            sys.exit(1)

    # 2. Build DataFrame and Validate
    df = pd.DataFrame(all_records)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').drop_duplicates(subset=['date'])

    # Validation
    total_rows = len(df)
    missing_count = df['rainfall_mm'].isna().sum()
    valid_count = total_rows - missing_count
    min_date = df['date'].min().strftime('%Y-%m-%d')
    max_date = df['date'].max().strftime('%Y-%m-%d')

    print("\n--- Validation Summary ---")
    print(f"Grid Cell Coordinates: {actual_lat}° N, {actual_lon}° E (Hyderabad nearest point)")
    print(f"Total Date Range: {min_date} to {max_date}")
    print(f"Total Daily Observations: {total_rows}")
    print(f"Valid Rainfall Observations: {valid_count}")
    print(f"Missing / Unrecorded Observations (preserved as NaN): {missing_count}")
    if valid_count > 0:
        valid_series = df['rainfall_mm'].dropna()
        print(f"Daily Mean Rainfall: {valid_series.mean():.2f} mm")
        print(f"Daily Max Rainfall: {valid_series.max():.2f} mm")
        print(f"Days with Rain (> 0 mm): {(valid_series > 0).sum()} days")

    # Format output date as YYYY-MM-DD
    df['date'] = df['date'].dt.strftime('%Y-%m-%d')
    df.to_csv(out_path, index=False)
    print(f"\n[SUCCESS] Saved validated dataset to {out_path.resolve()}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Preprocess IMD rainfall NetCDF data for Hyderabad.")
    parser.add_argument("--start-year", type=int, default=2014, help="Starting year (default: 2014)")
    parser.add_argument("--end-year", type=int, default=2024, help="Ending year (default: 2024)")
    parser.add_argument("--raw-dir", type=str, default="data/raw", help="Directory for raw NetCDF files")
    parser.add_argument("--output", type=str, default="data/rainfall.csv", help="Output CSV path")
    args = parser.parse_args()

    run_pipeline(
        start_year=args.start_year,
        end_year=args.end_year,
        raw_dir=args.raw_dir,
        output_file=args.output
    )
