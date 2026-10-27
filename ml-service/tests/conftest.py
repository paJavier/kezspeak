import sys
from pathlib import Path

import pytest

# Make `import app` work when pytest runs from ml-service/ or the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(scope="session", autouse=True)
def _stop_language_tool():
    # NLP tests start a LanguageTool Java server; stop it so runs don't leak memory.
    yield
    from app.pipeline import nlp

    nlp.shutdown()
