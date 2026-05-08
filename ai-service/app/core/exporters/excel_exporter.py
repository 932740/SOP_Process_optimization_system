import os
from typing import List, Dict, Any
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side

class ExcelExporter:
    def export(self, title: str, doc_type: str, steps: List[Dict[str, Any]], output_dir: str, filename: str) -> str:
        filepath = os.path.join(output_dir, f"{filename}.xlsx")
        wb = Workbook()
        ws = wb.active
        ws.title = "SOP步骤"

        # Header
        headers = ["步骤序号", "步骤标题", "操作描述"]
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Data
        for step in steps:
            ws.append([step['step_no'], step['title'], step['description']])

        # Adjust column widths
        ws.column_dimensions['A'].width = 12
        ws.column_dimensions['B'].width = 30
        ws.column_dimensions['C'].width = 80

        wb.save(filepath)
        return filepath
