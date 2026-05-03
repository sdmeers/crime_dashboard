import requests
import zipfile
import io
import pandas as pd

def test():
    month = "2024-04"
    url = f"https://policeuk-data.s3.amazonaws.com/archive/{month}.zip"
    print(f"Downloading {url}...")
    r = requests.get(url)
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        csv_files = [f for f in z.namelist() if f.endswith("-street.csv")]
        print(f"Found {len(csv_files)} street CSVs")
        if csv_files:
            df = pd.read_csv(z.open(csv_files[0]))
            print(df.columns)
            print(df.head())

if __name__ == "__main__":
    test()
