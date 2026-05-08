from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime

from app.core.exporters.markdown_exporter import MarkdownExporter
from app.core.exporters.word_exporter import WordExporter
from app.core.exporters.pdf_exporter import PdfExporter
from app.core.exporters.excel_exporter import ExcelExporter
from app.core.exporters.ppt_exporter import PptExporter

router = APIRouter()

class ExportRequest(BaseModel):
    document_id: int
    format_type: str
    title: str
    doc_type: Optional[str] = None
    steps: List[Dict[str, Any]]
    department: Optional[str] = None

@router.post("/generate")
async def generate_export(req: ExportRequest):
    try:
        exporter = get_exporter(req.format_type)
        filename = f"SOP_{req.document_id}_{req.format_type}_{uuid.uuid4().hex[:8]}"
        output_dir = "/tmp/exports"
        os.makedirs(output_dir, exist_ok=True)

        steps_data = []
        for step in req.steps:
            final_desc = step.get("ai_optimized_desc") or step.get("description") or ""
            steps_data.append({
                "step_no": step.get("step_no", 0),
                "title": step.get("title", ""),
                "description": final_desc,
                "image_urls": step.get("image_urls", []),
            })

        filepath = exporter.export(
            title=req.title,
            doc_type=req.doc_type,
            steps=steps_data,
            output_dir=output_dir,
            filename=filename,
        )

        return {
            "status": "done",
            "filename": os.path.basename(filepath),
            "filepath": filepath,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_exporter(format_type: str):
    format_map = {
        "markdown": MarkdownExporter,
        "word": WordExporter,
        "pdf": PdfExporter,
        "excel": ExcelExporter,
        "ppt": PptExporter,
    }
    exporter_class = format_map.get(format_type.lower())
    if not exporter_class:
        raise ValueError(f"Unsupported format: {format_type}")
    return exporter_class()
