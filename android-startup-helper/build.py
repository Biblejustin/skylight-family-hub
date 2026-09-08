#!/usr/bin/env python3
"""Dependency-free Android build using Google's aapt2, d8, zipalign and apksigner."""
from pathlib import Path
import argparse
import hashlib
import os
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent


def run(command, environment):
    subprocess.run([str(value) for value in command], check=True, cwd=ROOT, env=environment)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--jdk", type=Path, default=ROOT / ".toolchain/jdk-17.0.2.jdk/Contents/Home")
    parser.add_argument("--build-tools", type=Path, default=ROOT / ".toolchain/android-15")
    parser.add_argument("--android-jar", type=Path)
    args = parser.parse_args()
    jars = list((ROOT / ".toolchain").glob("android-33*/android.jar"))
    android_jar = args.android_jar or (jars[0] if jars else None)
    if android_jar is None or not (args.jdk / "bin/javac").exists():
        raise SystemExit("Missing tools. Run python3 bootstrap-toolchain.py or supply explicit paths.")
    environment = dict(os.environ)
    environment["JAVA_HOME"] = str(args.jdk)
    environment["PATH"] = str(args.jdk / "bin") + os.pathsep + environment.get("PATH", "")
    output = ROOT / "build"
    if output.exists():
        shutil.rmtree(output)
    for directory in [output, output / "generated", output / "classes", output / "dex"]:
        directory.mkdir(exist_ok=True)
    tool = args.build_tools
    run([tool / "aapt2", "compile", "--dir", ROOT / "res", "-o", output / "resources.zip"], environment)
    run([tool / "aapt2", "link", "-o", output / "unsigned.apk", "-I", android_jar,
         "--manifest", ROOT / "AndroidManifest.xml", "--java", output / "generated",
         output / "resources.zip"], environment)
    sources = sorted((ROOT / "src").rglob("*.java")) + sorted((output / "generated").rglob("*.java"))
    run([args.jdk / "bin/javac", "--release", "8", "-Xlint:all",
         "-classpath", android_jar, "-d", output / "classes", *sources], environment)
    classes = sorted((output / "classes").rglob("*.class"))
    run([tool / "d8", "--min-api", "26", "--lib", android_jar, "--output", output / "dex", *classes], environment)
    with zipfile.ZipFile(output / "unsigned.apk", "a", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(output / "dex/classes.dex", "classes.dex")
    run([tool / "zipalign", "-p", "-f", "4", output / "unsigned.apk", output / "aligned.apk"], environment)
    signing = ROOT / ".signing"
    signing.mkdir(mode=0o700, exist_ok=True)
    key = signing / "debug.keystore"
    if not key.exists():
        run([args.jdk / "bin/keytool", "-genkeypair", "-keystore", key,
             "-storepass", "android", "-keypass", "android", "-alias", "androiddebugkey",
             "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
             "-dname", "CN=Family Hub Startup Debug,O=Local Development,C=US"], environment)
        key.chmod(0o600)
    apk = output / "family-hub-startup-debug.apk"
    run([tool / "apksigner", "sign", "--ks", key, "--ks-key-alias", "androiddebugkey",
         "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", apk,
         output / "aligned.apk"], environment)
    run([tool / "apksigner", "verify", "--verbose", "--print-certs", apk], environment)
    run([tool / "zipalign", "-c", "-p", "4", apk], environment)
    digest = hashlib.sha256(apk.read_bytes()).hexdigest()
    (output / "SHA256SUMS").write_text(digest + "  " + apk.name + "\n")
    print("APK:", apk)
    print("SHA256:", digest)


if __name__ == "__main__":
    main()
