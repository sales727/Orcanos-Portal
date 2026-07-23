import threading

# Maps job_id -> {"cancelled": bool, "processed_rows": int, "total_rows": int, "results": list}
# Protected by import_jobs_lock so the cancel endpoint (different request) can safely
# set the flag while the streaming import loop reads it.
import_jobs: dict = {}
import_jobs_lock = threading.Lock()
