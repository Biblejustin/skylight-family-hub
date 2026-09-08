#!/usr/bin/env python3
"""Fetch pinned official tools into this project. Never installs globally."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import new as new_hash
from pathlib import Path
import json
import platform
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT / ".toolchain"
PACKAGES = [
    {
        "name": "openjdk-17.0.2_macos-aarch64_bin.tar.gz",
        "url": "https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_macos-aarch64_bin.tar.gz",
        "algorithm": "sha256", "digest": "602d7de72526368bb3f80d95c4427696ea639d2e0cc40455f53ff0bbb18c27c8",
    },
    {
        "name": "build-tools_r35_macosx.zip",
        "url": "https://dl.google.com/android/repository/build-tools_r35_macosx.zip",
        "algorithm": "sha1", "digest": "93ab8ce91230e067b5add4bfa79919c52b27f072",
    },
    {
        "name": "platform-33-ext5_r01.zip",
        "url": "https://dl.google.com/android/repository/platform-33-ext5_r01.zip",
        "algorithm": "sha1", "digest": "a6499e158fdd7140e3e466314b273016281fefcc",
    },
]


def download(package):
    destination = TOOLS / package["name"]
    if not destination.exists():
        temporary = destination.with_suffix(destination.suffix + ".partial")
        print("Downloading", package["name"], flush=True)
        with urllib.request.urlopen(package["url"], timeout=60) as response, temporary.open("wb") as out:
            while chunk := response.read(1024 * 1024):
                out.write(chunk)
        temporary.replace(destination)
    digest = new_hash(package["algorithm"])
    sha256 = new_hash("sha256")
    with destination.open("rb") as archive:
        while chunk := archive.read(1024 * 1024):
            digest.update(chunk)
            sha256.update(chunk)
    if digest.hexdigest() != package["digest"]:
        raise RuntimeError("Official archive checksum mismatch: " + package["name"])
    print("Verified", package["name"], flush=True)
    return {**package, "sha256": sha256.hexdigest()}


def main():
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        raise SystemExit("Bootstrap is pinned for Apple silicon macOS. Supply your own toolchain to build.py elsewhere.")
    TOOLS.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as executor:
        receipts = list(executor.map(download, PACKAGES))
    if not (TOOLS / "jdk-17.0.2.jdk").exists():
        subprocess.run(["tar", "-xzf", str(TOOLS / PACKAGES[0]["name"]), "-C", str(TOOLS)], check=True)
    if not (TOOLS / "android-15").exists():
        subprocess.run(["unzip", "-q", str(TOOLS / PACKAGES[1]["name"]), "-d", str(TOOLS)], check=True)
    if not list(TOOLS.glob("android-33*/android.jar")):
        subprocess.run(["unzip", "-q", str(TOOLS / PACKAGES[2]["name"]), "-d", str(TOOLS)], check=True)
    (TOOLS / "download-receipts.json").write_text(json.dumps(receipts, indent=2) + "\n")
    print("Toolchain ready inside", TOOLS)


if __name__ == "__main__":
    main()
