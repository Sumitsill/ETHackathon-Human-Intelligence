import os
import sys
import subprocess
import time

def main():
    port = os.getenv("PORT", "8000")
    
    # 1. Start Module 2 (Grounded Copilot) on 127.0.0.1:8001
    print("[Gateway] Starting Module 2 on 127.0.0.1:8001...")
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=os.path.join(os.getcwd(), "ML MODELS", "Md 2")
    )
    
    # 2. Start Module 3 (MIRA) on 127.0.0.1:8002
    print("[Gateway] Starting Module 3 on 127.0.0.1:8002...")
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8002"],
        cwd=os.path.join(os.getcwd(), "ML MODELS", "Md 3", "Mod 3")
    )
    
    # 3. Start Module 4 (QRCI) on 127.0.0.1:8003
    print("[Gateway] Starting Module 4 on 127.0.0.1:8003...")
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8003"],
        cwd=os.path.join(os.getcwd(), "ML MODELS", "Md 4", "Mod 4")
    )
    
    time.sleep(3)
    
    # 4. Starts Module 1 (Ingestion) as the foreground process on the public PORT
    print(f"[Gateway] Starting Module 1 on 0.0.0.0:{port}...")
    cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", port]
    subprocess.run(cmd, cwd=os.path.join(os.getcwd(), "ML MODELS", "Md 1", "backend"))

if __name__ == "__main__":
    main()
