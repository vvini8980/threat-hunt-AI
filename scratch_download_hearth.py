import os
import zipfile
import io
import requests

url = "https://github.com/THORCollective/HEARTH/archive/refs/heads/main.zip"
print(f"Downloading {url}...")
r = requests.get(url)
print("Downloaded. Extracting...")
z = zipfile.ZipFile(io.BytesIO(r.content))

# Let's see some file paths in the zip
names = z.namelist()
print(f"Total files in zip: {len(names)}")

flames = [n for n in names if "/Flames/" in n and n.endswith(".md")]
embers = [n for n in names if "/Embers/" in n and n.endswith(".md")]
alchemy = [n for n in names if "/Alchemy/" in n and n.endswith(".md")]

print(f"Flames: {len(flames)}, Embers: {len(embers)}, Alchemy: {len(alchemy)}")

if flames:
    print(f"\nSample Flame file path: {flames[0]}")
    sample_content = z.read(flames[0]).decode('utf-8')
    print("--- CONTENT ---")
    print("\n".join(sample_content.splitlines()[:20]))
    print("----------------")
