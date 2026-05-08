import os
from typing import List, Dict, Any
from weasyprint import HTML, CSS

class PdfExporter:
    def export(self, title: str, doc_type: str, steps: List[Dict[str, Any]], output_dir: str, filename: str) -> str:
        filepath = os.path.join(output_dir, f"{filename}.pdf")

        html_content = f"""
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: "Microsoft YaHei", "SimHei", sans-serif; padding: 40px; }}
                h1 {{ text-align: center; color: #333; }}
                h2 {{ color: #444; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }}
                .step {{ margin-bottom: 20px; }}
                .desc {{ line-height: 1.8; color: #555; }}
            </style>
        </head>
        <body>
            <h1>{title}</h1>
            {f'<p><strong>文档类型:</strong> {doc_type}</p>' if doc_type else ''}
        """

        for step in steps:
            html_content += f"""
            <div class="step">
                <h2>步骤 {step['step_no']}: {step['title']}</h2>
                <div class="desc">{step['description'].replace(chr(10), '<br>')}</div>
            </div>
            """

        html_content += "</body></html>"

        HTML(string=html_content).write_pdf(filepath)
        return filepath
