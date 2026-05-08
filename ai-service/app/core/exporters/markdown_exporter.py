import os
from typing import List, Dict, Any

class MarkdownExporter:
    def export(self, title: str, doc_type: str, steps: List[Dict[str, Any]], output_dir: str, filename: str) -> str:
        filepath = os.path.join(output_dir, f"{filename}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# {title}\n\n")
            if doc_type:
                f.write(f"**文档类型**: {doc_type}\n\n")
            f.write(f"**生成时间**: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
            f.write("---\n\n")
            for step in steps:
                f.write(f"## 步骤 {step['step_no']}: {step['title']}\n\n")
                f.write(f"{step['description']}\n\n")
                if step.get('image_urls'):
                    for url in step['image_urls']:
                        f.write(f"![步骤图片]({url})\n\n")
                f.write("\n")
        return filepath
