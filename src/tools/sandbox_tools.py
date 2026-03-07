import os
import tempfile
import subprocess
import json
from langchain_core.tools import tool
from src.tools.canvas_tools import _push_action

@tool
def execute_python_code(session_id: str, code: str) -> str:
    """
    Executes a block of Python code in an isolated sandbox environment and returns the stdout/stderr.
    Use this if you need to calculate complex proprietary mathematics, simulations, arrays 
    or logic not provided natively by the core finance APIs.
    
    WARNING: The code must be self-contained. You should print() the final result you want to capture.
    
    As a side-effect, this tool AUTOMATICALLY creates a 'sandbox' widget on the user's interactive canvas 
    displaying the code you wrote and the output of the terminal.
    """
    
    # 1. Execute the python code
    stdout_output = ""
    stderr_output = ""
    status = "success"
    
    try:
        # Create a temp file to hold the script
        with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as f:
            f.write(code)
            script_path = f.name
            
        # Run it in a subprocess
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            text=True,
            timeout=15  # Terminate infinite loops after 15 seconds
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
        # Clean up temp file
        if 'script_path' in locals() and os.path.exists(script_path):
            os.remove(script_path)
    
    final_output = stdout_output
    if stderr_output:
        final_output += f"\n[STDERR]\n{stderr_output}"
        
    final_output = final_output.strip()
    if not final_output:
        final_output = "Script executed successfully but didn't produce any print() output."
        
    # 2. Automatically spawn a widget on the UI for the user to see the code execution
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
                    "status": status
                }
            }
        }
    }
    _push_action(session_id, action)
    
    # 3. Return the result back to the LLM agent
    return json.dumps({
        "status": status,
        "stdout": stdout_output,
        "stderr": stderr_output,
        "canvas_widget_id": new_id
    }, indent=2)
