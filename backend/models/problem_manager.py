import os
import re
from typing import Dict, List, Optional

class ProblemManager:
    def __init__(self, problems_dir: str = "problems"):
        self.problems_dir = problems_dir
        self.problems: Dict[str, dict] = {}
        self.load_problems()

    def load_problems(self):
        """
        Scans the problems directory and builds an in-memory index of available problems.
        """
        print(f"Loading problems from {self.problems_dir}...")
        
        # Curated Problem List (add more ilater)
        ALLOWED_IDS = {"0001", "0002"}
        curated_mode = True

        allowed_problems = ALLOWED_IDS
        if curated_mode:
            # Optional: Load from a file if it exists, otherwise use hardcoded
            curated_file = os.path.join(self.problems_dir, "curated.txt")
            if os.path.exists(curated_file):
                with open(curated_file, "r") as f:
                    file_ids = {line.strip() for line in f if line.strip()}
                    if file_ids:
                        allowed_problems = file_ids
                print(f"Curated mode enabled (File). Allowed problems: {allowed_problems}")
            else:
                print(f"Curated mode enabled (Hardcoded). Allowed problems: {allowed_problems}")

        # Supported languages w extensions
        langs = {
            "python": ".py",
            "cpp": ".cpp",
            "javascript": ".js"
        }

        temp_index = {}

        # Iterate over each language folder
        for lang, ext in langs.items():
            lang_dir = os.path.join(self.problems_dir, lang)
            if not os.path.exists(lang_dir):
                print(f"Warning: Directory {lang_dir} not found.")
                continue

            for filename in os.listdir(lang_dir):
                if not filename.endswith(ext):
                    continue

                match = re.match(r"^(\d+)-(.*)\.(.*)$", filename)
                if not match:
                    continue

                prob_id, slug, _ = match.groups()
                
                if curated_mode and prob_id not in allowed_problems:
                    continue
                
                # Normalize title from slug (two-sum to Two Sum)
                title = slug.replace("-", " ").title()

                if prob_id not in temp_index:
                    temp_index[prob_id] = {
                        "id": prob_id,
                        "title": title,
                        "slug": slug,
                        "difficulty": "Medium", # Default difficulty (TODO: Improve later)
                        "languages": [],
                        "paths": {}
                    }

                temp_index[prob_id]["languages"].append(lang)
                temp_index[prob_id]["paths"][lang] = os.path.join(lang_dir, filename)
        
        self.problems = temp_index

    def get_problem_metadata(self, problem_id: str) -> Optional[dict]:
        """Returns the metadata (title, languages) without the content."""
        return self.problems.get(problem_id)

    def get_problem_content(self, problem_id: str, language: str) -> Optional[str]:
        """Lazy loads the content of a specific problem file."""
        problem = self.problems.get(problem_id)
        if not problem:
            return None
        
        file_path = problem["paths"].get(language)
        if not file_path:
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return None

    def get_all_problems(self) -> List[dict]:
        """Returns a list of all problem metadata."""
        return list(self.problems.values())

# Singleton
problem_manager = ProblemManager()