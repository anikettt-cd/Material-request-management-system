cd C:\viraj_project
call .venv\Scripts\activate.bat
uvicorn backend.main:app --host 0.0.0.0 --port 8000

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
