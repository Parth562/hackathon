import os
import tempfile
import subprocess
import json
from langchain_core.tools import tool
from src.tools.canvas_tools import _push_action

def run_python_script(code: str, inputs: dict = None) -> dict:
    """Core helper to execute python code with optional input injection."""
    full_code = ""
    if inputs:
        for k, v in inputs.items():
            # Basic injection: if it's a string, wrap in quotes, else raw (for numbers/booleans/lists)
            if isinstance(v, str):
                full_code += f"{k} = {repr(v)}\n"
            else:
                full_code += f"{k} = {json.dumps(v)}\n"
    
    full_code += code
    
    stdout_output = ""
    stderr_output = ""
    status = "success"
    script_path = None
    
    try:
        with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as f:
            f.write(full_code)
            script_path = f.name
            
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            encoding="utf-8",
            timeout=15
        )
        
        stdout_output = result.stdout
        stderr_output = result.stderr
        
        if result.returncode != 0:
            status = "error"
            
    except subprocess.TimeoutExpired:
        status = "timeout"
        stderr_output = "Execution timed out after 15 seconds."
    except Exception as e:
        status = "error"
        stderr_output = f"Sandbox Exception: {str(e)}"
    finally:
        if script_path and os.path.exists(script_path):
            os.remove(script_path)
            
    # Try to parse stdout as JSON if it looks like it, otherwise use raw
    parsed_result = None
    try:
        # If the script printed only one line and it's valid JSON
        lines = stdout_output.strip().split('\n')
        if lines:
            last_line = lines[-1].strip()
            parsed_result = json.loads(last_line)
    except:
        # Fallback: if stdout is a single number or string, use it
        stripped = stdout_output.strip()
        if stripped:
            if stripped.replace('.','',1).isdigit():
                parsed_result = float(stripped) if '.' in stripped else int(stripped)
            else:
                parsed_result = stripped

    return {
        "status": status,
        "stdout": stdout_output,
        "stderr": stderr_output,
        "result": parsed_result
    }

@tool
def execute_python_code(session_id: str, code: str, inputs: dict = None) -> str:
    """
    Executes a block of Python code in an isolated sandbox environment and returns the stdout/stderr.
    
    Inputs can be provided as a dictionary and will be injected as variables into the script.
    e.g. if inputs={'a': 10}, the script can use the variable `a`.
    
    The tool automatically creates a 'sandbox' widget on the canvas.
    """
    res = run_python_script(code, inputs)
    
    final_output = res["stdout"]
    if res["stderr"]:
        final_output += f"\n[STDERR]\n{res['stderr']}"
    final_output = final_output.strip() or "Script executed successfully."
    
    import uuid
    new_id = f"sandbox-{uuid.uuid4().hex[:8]}"
    
    action = {
        "type": "add_node",
        "node": {
            "id": new_id,
            "type": "customWidget",
            "position": {"x": 200, "y": 200},
            "data": {
                "widgetData": {
                    "widget_type": "sandbox",
                    "code": code,
                    "output": final_output,
                    "status": res["status"],
                    "inputs": inputs or {}
                }
            }
        }
    }
    _push_action(session_id, action)
    
    return json.dumps({
        **res,
        "canvas_widget_id": new_id
    }, indent=2)
