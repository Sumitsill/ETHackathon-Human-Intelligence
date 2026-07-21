import os
import sys
import subprocess
import time
import signal

# Define default fallback backend API key
GLOBAL_API_KEY = "et_brain_secure_key_2026_xyz"
os.environ["GLOBAL_API_KEY"] = GLOBAL_API_KEY

# Set NEO4J_URI to empty by default to avoid long socket timeouts on startup lifespans
os.environ["NEO4J_URI"] = ""

# Load environment variables from root or ML MODELS .env if existing
env_paths = [
    os.path.join(os.getcwd(), ".env"),
    os.path.join(os.getcwd(), "ML MODELS", ".env")
]
for env_path in env_paths:
    if os.path.exists(env_path):
        print(f"[Orchestrator] Loading environment variables from {env_path}")
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().strip("'\"")
                    os.environ[key] = val
                    print(f"  Loaded: {key}")

processes = []
log_files = []

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

def signal_handler(sig, frame):
    print("\n[Orchestrator] Shutting down all backend servers cleanly...")
    for p in processes:
        try:
            p.terminate()
        except:
            pass
    for f in log_files:
        try:
            f.close()
        except:
            pass
    print("[Orchestrator] Terminated all backend processes. Bye!")
    sys.exit(0)

# Register clean exit signals
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def run():
    print("="*75)
    print("           ET UNIFIED OPERATIONS BRAIN CONCURRENT LAUNCHER")
    print(f"           Global Authorization API Key: {GLOBAL_API_KEY}")
    print("="*75)

    cwds = [
        os.path.join(os.getcwd(), "ML MODELS", "Md 1", "backend"),
        os.path.join(os.getcwd(), "ML MODELS", "Md 2"),
        os.path.join(os.getcwd(), "ML MODELS", "Md 3", "Mod 3"),
        os.path.join(os.getcwd(), "ML MODELS", "Md 4", "Mod 4")
    ]
    ports = ["8000", "8001", "8002", "8003"]
    names = ["Module 1 Ingestion", "Module 2 Copilot", "Module 3 MIRA", "Module 4 QRCI"]

    for i in range(4):
        print(f"[Orchestrator] Starting {names[i]} on port {ports[i]} (Logs: logs/module{i+1}.log)...")
        log_f = open(f"logs/module{i+1}.log", "w", encoding="utf-8")
        log_files.append(log_f)
        
        p = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", ports[i]],
            cwd=cwds[i],
            stdout=log_f,
            stderr=log_f
        )
        processes.append(p)
        time.sleep(1)

    print("="*75)
    print("  All 4 backend servers initiated.")
    print("  Press Ctrl+C to terminate all servers together.")
    print("="*75)

    # Keep orchestrator alive and monitor subprocess health
    try:
        while True:
            for i, p in enumerate(processes):
                if p.poll() is not None:
                    print(f"\n[Warning] {names[i]} exited with code {p.returncode}. Restarting...")
                    log_files[i].close()
                    log_f = open(f"logs/module{i+1}.log", "a", encoding="utf-8")
                    log_files[i] = log_f
                    
                    processes[i] = subprocess.Popen(
                        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", ports[i]],
                        cwd=cwds[i],
                        stdout=log_f,
                        stderr=log_f
                    )
            time.sleep(2)
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    run()

